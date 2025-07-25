const docker = require("dockerode")();
const path = require("path");
const fs = require("fs");
const { createTarStream } = require("./fileUtils");
const os = require("os");
const { performance } = require("perf_hooks");

/**
 * Executes code in a Docker container for each test case.
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
  // Initialize variables
  let container;
  let timeoutHandle;
  let wasKilled = false;
  try {
    // Create a Docker container
    container = await docker.createContainer({
      Image: LANGUAGE_CONFIG[language].image,
      Cmd: LANGUAGE_CONFIG[language].cmd(
        path.basename(codeFilename),
        inputFilePath ? path.basename(inputFilePath) : null
      ),
      AttachStdout: true,
      AttachStderr: true,
      AttachStdin: true,
      Tty: false,
      HostConfig: {
        Memory: constraints.memoryLimit * 1024 * 1024,
        CpuPeriod: 100000,
        CpuQuota: constraints.timeLimit * 100000,
        AutoRemove: true,
        NetworkMode: "none",
        MemorySwap: 0,
      },
    });

    // Create a tar stream of the code and input files
    const filesToTransfer = inputFilePath
      ? [codeFilePath, inputFilePath]
      : [codeFilePath];
    const tarStream = createTarStream(filesToTransfer);

    // Put the tar stream into the container
    await container.putArchive(tarStream, { path: "/" });

    // Start the container
    await container.start();

    // Attach to the container
    const stream = await container.attach({
      stream: true,
      stdin: true,
      stdout: true,
      stderr: true,
      logs: true,
    });

    // Read the output from the container
    let output = "";
    const streamPromise = new Promise((resolve) => {
      stream.on("data", (chunk) => {
        if (chunk[0] <= 2) {
          output += chunk.slice(8).toString();
        }
      });
      stream.on("end", resolve);
      stream.on("error", resolve);
    });

    // Set a timeout for the container
    const startTime = performance.now();
    timeoutHandle = setTimeout(() => {
      wasKilled = true;
      container.kill().catch(() => {});
    }, constraints.timeLimit * 1000);

    // Wait for the container to exit
    const [exitResult] = await Promise.all([container.wait(), streamPromise]);

    // Calculate the time used
    const endTime = performance.now();
    clearTimeout(timeoutHandle);

    const timeUsed = parseFloat(((endTime - startTime) / 1000).toFixed(3));

    // Calculate the memory used
    let memoryUsed = 0;
    try {
      const stats = await container.stats({ stream: false });
      memoryUsed = stats.memory_stats?.usage
        ? Math.round(stats.memory_stats.usage / (1024 * 1024))
        : 0;
    } catch {}

    // Clean the output
    const cleanOutput = output.replace(/[^\x20-\x7E]+/g, "").trim();
    const exitCode = exitResult.StatusCode;

    // Set the verdict
    let verdict = "OK";
    let finalOutput = cleanOutput;

    // Set the verdict based on the exit code and time used
    if (wasKilled || timeUsed > constraints.timeLimit) {
      verdict = "TLE";
      finalOutput = "Time Limit Exceeded";
    } else if (exitCode === 137 || memoryUsed > constraints.memoryLimit) {
      verdict = "MLE";
      finalOutput = "Memory Limit Exceeded";
    } else if (exitCode !== 0) {
      verdict = "RTE";
      finalOutput = "Runtime Error";
    }

    // Return the result
    return {
      input: input?.filename,
      test: testIndex + 1,
      verdict,
      output: finalOutput,
      timeUsed,
      memoryUsed,
    };
  } finally {
    // Clean up the input file and container
    try {
      if (inputFilePath?.includes("/tmp/") && fs.existsSync(inputFilePath)) {
        fs.unlinkSync(inputFilePath);
      }
      if (container) {
        await container.stop().catch(() => {});
        await container.remove({ force: true }).catch(() => {});
      }
    } catch (err) {
      console.error("Cleanup error:", err);
    }
    // Clear the timeout
    clearTimeout(timeoutHandle);
  }
}

const LANGUAGE_CONFIG = {
  python: {
    image: "python:3.12-slim",
    cmd: (codeFileName, inputFileName) =>
      inputFileName
        ? ["bash", "-c", `python ${codeFileName} < ${inputFileName}`]
        : ["python", codeFileName],
  },
  cpp: {
    image: "gcc:12",
    cmd: (codeFileName, inputFileName) => {
      const run = inputFileName ? `./main < ${inputFileName}` : `./main`;
      return ["bash", "-c", `g++ ${codeFileName} -o main && ${run}`];
    },
  },
};

module.exports = { executeCode };
