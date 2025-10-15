const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const { performance } = require("perf_hooks");

/**
 * Executes code using Node.js child_process for cloud deployment
 * @param {Object} params
 * @param {string} params.codeFilename
 * @param {string} params.language
 * @param {Array} params.inputFiles
 * @param {Object} params.constraints
 * @returns {Promise<Array>} Results for each test case
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
  let process;
  let timeoutHandle;
  let wasKilled = false;

  try {
    const startTime = performance.now();

    // Set up the command based on language
    const config = LANGUAGE_CONFIG[language];
    const cmd = config.getCommand(codeFilePath, inputFilePath);

    console.log(`Executing: ${cmd.join(" ")}`);

    // Spawn the process
    process = spawn(cmd[0], cmd.slice(1), {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: constraints.timeLimit * 1000,
    });

    // Set up timeout
    timeoutHandle = setTimeout(() => {
      wasKilled = true;
      if (process && !process.killed) {
        process.kill("SIGKILL");
      }
    }, constraints.timeLimit * 1000);

    // Handle process output
    let output = "";
    let errorOutput = "";

    process.stdout.on("data", (data) => {
      output += data.toString();
    });

    process.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    // Wait for process to complete
    const exitCode = await new Promise((resolve, reject) => {
      process.on("close", (code, signal) => {
        resolve(code);
      });

      process.on("error", (err) => {
        reject(err);
      });
    });

    const endTime = performance.now();
    const timeUsed = parseFloat(((endTime - startTime) / 1000).toFixed(3));

    clearTimeout(timeoutHandle);

    // Clean the output
    const cleanOutput = output.replace(/[^\x20-\x7E]+/g, "").trim();
    const cleanError = errorOutput.replace(/[^\x20-\x7E]+/g, "").trim();

    // Set the verdict
    let verdict = "OK";
    let finalOutput = cleanOutput;

    // Determine verdict based on exit code, time, and memory usage
    if (wasKilled || timeUsed > constraints.timeLimit) {
      verdict = "TLE";
      finalOutput = "Time Limit Exceeded";
    } else if (exitCode !== 0) {
      verdict = "RTE";
      finalOutput = cleanError || "Runtime Error";
    }

    // Return the result
    return {
      input: input?.filename,
      test: testIndex + 1,
      verdict,
      output: finalOutput,
      timeUsed,
      memoryUsed: 0, // We can't easily track memory in cloud environment
    };
  } catch (error) {
    clearTimeout(timeoutHandle);
    return {
      input: input?.filename,
      test: testIndex + 1,
      verdict: "RTE",
      output: `Execution Error: ${error.message}`,
      timeUsed: 0,
      memoryUsed: 0,
    };
  } finally {
    if (process && !process.killed) {
      process.kill();
    }
  }
}

const LANGUAGE_CONFIG = {
  python: {
    getCommand: (codeFilePath, inputFilePath) => {
      if (inputFilePath) {
        return ["python3", codeFilePath, "<", inputFilePath];
      }
      return ["python3", codeFilePath];
    },
  },
  cpp: {
    getCommand: (codeFilePath, inputFilePath) => {
      const outputPath = codeFilePath.replace(".cpp", "_compiled");
      const compileCmd = ["g++", "-o", outputPath, codeFilePath];

      if (inputFilePath) {
        return [
          "bash",
          "-c",
          `g++ -o ${outputPath} ${codeFilePath} && ${outputPath} < ${inputFilePath}`,
        ];
      }
      return [
        "bash",
        "-c",
        `g++ -o ${outputPath} ${codeFilePath} && ${outputPath}`,
      ];
    },
  },
};

module.exports = { executeCode };
