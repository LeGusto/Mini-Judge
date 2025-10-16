const { spawn, exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const { performance } = require("perf_hooks");

/**
 * Cloud-friendly code execution without Docker
 * Uses system processes with resource limits via timeout and ulimit
 */
async function executeCode({
  codeFilename,
  language,
  inputFiles = [],
  constraints,
}) {
  // Check if the language is supported
  if (!LANGUAGE_CONFIG[language]) {
    throw new Error("Unsupported language");
  }

  // Create a temporary directory for the code and input files
  const tmpDir = path.join(path.dirname(__dirname), "tmp");
  const codeFilePath = path.join(tmpDir, codeFilename);
  if (!fs.existsSync(codeFilePath)) {
    throw new Error(`Code file does not exist: ${codeFilePath}`);
  }

  // Initialize an array to store the results
  const results = [];

  // Loop through each test case
  for (let i = 0; i < constraints.tests; i++) {
    const input = i < inputFiles.length ? inputFiles[i] : null;
    const inputFilePath = input?.absolutePath || null;

    // Execute the test case
    const result = await runSingleTest({
      codeFilePath,
      codeFilename,
      language,
      input,
      inputFilePath,
      constraints,
      testIndex: i,
    });
    results.push(result);
  }

  // Clean up the uploaded code file
  if (codeFilePath.includes("/tmp/") && fs.existsSync(codeFilePath)) {
    fs.unlinkSync(codeFilePath);
  }

  return results;
}

// Helper function to execute a single test case
async function runSingleTest({
  codeFilePath,
  codeFilename,
  language,
  input,
  inputFilePath,
  constraints,
  testIndex,
}) {
  const langConfig = LANGUAGE_CONFIG[language];
  const tmpDir = path.dirname(codeFilePath);

  try {
    // Compile if needed
    let executablePath = codeFilePath;
    if (langConfig.compile) {
      executablePath = await compileCode(codeFilePath, language, tmpDir);
    }

    // Prepare command and arguments
    const cmd = langConfig.cmd || langConfig.run;
    const args = langConfig.args
      ? langConfig.args(
          path.basename(executablePath),
          inputFilePath ? path.basename(inputFilePath) : null
        )
      : [path.basename(executablePath)];

    // Set up input stream
    let inputStream = null;
    if (inputFilePath && fs.existsSync(inputFilePath)) {
      inputStream = fs.createReadStream(inputFilePath);
    }

    // Execute the code with timeout and memory limits
    const result = await executeWithLimits({
      command: cmd,
      args: args,
      cwd: tmpDir,
      inputStream: inputStream,
      timeLimit: constraints.timeLimit,
      memoryLimit: constraints.memoryLimit,
    });

    // Clean up compiled executable if it exists
    if (executablePath !== codeFilePath && fs.existsSync(executablePath)) {
      fs.unlinkSync(executablePath);
    }

    // Clean up input file
    if (inputFilePath?.includes("/tmp/") && fs.existsSync(inputFilePath)) {
      fs.unlinkSync(inputFilePath);
    }

    return {
      input: input?.filename,
      test: testIndex + 1,
      verdict: result.verdict,
      output: result.output,
      timeUsed: result.timeUsed,
      memoryUsed: result.memoryUsed,
    };
  } catch (error) {
    console.error(`Test execution error: ${error.message}`);
    return {
      input: input?.filename,
      test: testIndex + 1,
      verdict: "RTE",
      output: "Runtime Error",
      timeUsed: 0,
      memoryUsed: 0,
    };
  }
}

// Compile code if needed
async function compileCode(codeFilePath, language, tmpDir) {
  const langConfig = LANGUAGE_CONFIG[language];
  if (!langConfig.compile) {
    return codeFilePath;
  }

  const { compile } = langConfig;
  const executableName = compile.executable || "main";
  const executablePath = path.join(tmpDir, executableName);

  return new Promise((resolve, reject) => {
    const compileProcess = spawn(
      compile.command,
      compile.args(codeFilePath, executablePath),
      {
        cwd: tmpDir,
        stdio: ["pipe", "pipe", "pipe"],
      }
    );

    let compileOutput = "";
    let compileError = "";

    compileProcess.stdout.on("data", (data) => {
      compileOutput += data.toString();
    });

    compileProcess.stderr.on("data", (data) => {
      compileError += data.toString();
    });

    compileProcess.on("close", (code) => {
      if (code === 0) {
        resolve(executablePath);
      } else {
        reject(new Error(`Compilation failed: ${compileError}`));
      }
    });

    compileProcess.on("error", (err) => {
      reject(new Error(`Compilation error: ${err.message}`));
    });
  });
}

// Execute code with resource limits
async function executeWithLimits({
  command,
  args,
  cwd,
  inputStream,
  timeLimit,
  memoryLimit,
}) {
  return new Promise((resolve) => {
    const startTime = performance.now();
    let output = "";
    let error = "";
    let wasKilled = false;

    // Set up the process with ulimit for memory and use time command for better tracking
    const env = { ...process.env };
    const ulimitCmd = `ulimit -v $(( ${memoryLimit} * 1024 )) && time -v ${command} ${args.join(
      " "
    )} 2>&1`;

    const child = spawn("bash", ["-c", ulimitCmd], {
      cwd: cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: env,
      shell: false,
    });

    // Set timeout
    const timeout = setTimeout(() => {
      wasKilled = true;
      child.kill("SIGKILL");
    }, timeLimit * 1000);

    // Handle input
    if (inputStream) {
      inputStream.pipe(child.stdin);
    }

    // Collect output
    child.stdout.on("data", (data) => {
      output += data.toString();
    });

    child.stderr.on("data", (data) => {
      error += data.toString();
    });

    // Handle process completion
    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      const endTime = performance.now();
      const timeUsed = parseFloat(((endTime - startTime) / 1000).toFixed(3));

      let verdict = "OK";
      let finalOutput = output.trim();

      // Determine verdict
      if (wasKilled || timeUsed > timeLimit) {
        verdict = "TLE";
        finalOutput = "Time Limit Exceeded";
      } else if (signal === "SIGKILL" || (error && error.includes("memory"))) {
        verdict = "MLE";
        finalOutput = "Memory Limit Exceeded";
      } else if (code !== 0) {
        verdict = "RTE";
        finalOutput = error.trim() || "Runtime Error";
      }

      // Parse memory usage from time command output
      let memoryUsed = 0;
      const maxMemoryMatch = error.match(
        /Maximum resident set size \(kbytes\): (\d+)/
      );
      if (maxMemoryMatch) {
        memoryUsed = parseInt(maxMemoryMatch[1]) * 1024; // Convert KB to bytes
      } else {
        // Fallback: rough estimate based on output size
        memoryUsed = Math.max(0, Math.round(output.length * 10));
      }

      resolve({
        verdict,
        output: finalOutput,
        timeUsed,
        memoryUsed,
      });
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      resolve({
        verdict: "RTE",
        output: `Execution error: ${err.message}`,
        timeUsed: 0,
        memoryUsed: 0,
      });
    });
  });
}

// Cloud-friendly language configuration
const LANGUAGE_CONFIG = {
  python: {
    run: "python3",
    args: (codeFileName, inputFileName) => [codeFileName],
  },
  cpp: {
    compile: {
      command: "g++",
      args: (sourcePath, executablePath) => [
        "-std=c++17",
        "-O2",
        "-Wall",
        "-o",
        executablePath,
        sourcePath,
      ],
      executable: "main",
    },
    run: "./main",
    args: () => [],
  },
};

module.exports = { executeCode };
