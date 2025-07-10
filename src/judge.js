const docker = require("dockerode")();
const config = require("../config");
const path = require("path");
const fs = require("fs");
const tar = require("tar");
const { performance } = require("perf_hooks");
const { code } = require("tar/types");

function createTarStream(filePaths) {
  const dir = path.dirname(filePaths[0]);
  const files = filePaths.map((f) => path.basename(f));
  return tar.create({ cwd: dir, entries: files }, files);
}

function verifyFileExists(fileName) {
  const tmpDir = path.join(path.dirname(__dirname), "tmp");
  const filePath = path.join(tmpDir, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`File does not exist: ${filePath}`);
  }
  return filePath;
}

const LANGUAGE_CONFIG = {
  python: {
    image: "python:3.12-slim",
    cmd: (codeFilePath, inputFilePath) =>
      inputFilePath
        ? ["bash", "-c", `python ${codeFilePath} < ${inputFilePath}`]
        : ["python", codeFilePath],
  },
  cpp: {
    image: "gcc:12",
    cmd: (codeFilePath, inputFilePath) => {
      const run = inputFilePath ? `./main < ${inputFilePath}` : `./main`;
      return ["bash", "-c", `g++ ${codeFilePath} -o main && ${run}`];
    },
  },
};

async function executeCode({ codeFilename, language, inputFilename }) {
  if (!LANGUAGE_CONFIG[language]) {
    throw new Error("Unsupported language");
  }

  const codeFilePath = verifyFileExists(codeFilename);
  const inputFilePath = inputFilename ? verifyFileExists(inputFilename) : null;

  const container = await docker.createContainer({
    Image: LANGUAGE_CONFIG[language].image,
    Cmd: LANGUAGE_CONFIG[language].cmd(codeFilename, inputFilename),
    AttachStdout: true,
    AttachStderr: true,
    AttachStdin: true,
    Tty: false,
    HostConfig: {
      Memory: config.constraints.memoryLimit * 1024 * 1024,
      CpuPeriod: 100000,
      CpuQuota: config.constraints.timeLimit * 100000, // timeLimit in seconds
      AutoRemove: true,
      NetworkMode: "none",
      MemorySwap: 0,
    },
  });

  let timeoutHandle;
  let wasKilled = false;

  try {
    const filesToTransfer = inputFilename
      ? [codeFilePath, inputFilePath]
      : [codeFilePath];

    const tarStream = createTarStream(filesToTransfer);
    await container.putArchive(tarStream, { path: "/" });
    await container.start();

    const stream = await container.attach({
      stream: true,
      stdin: true,
      stdout: true,
      stderr: true,
      logs: true,
    });

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

    // Start wall timer
    const startTime = performance.now();

    // Kill container if it exceeds time limit
    timeoutHandle = setTimeout(() => {
      wasKilled = true;
      container.kill().catch(() => {});
    }, config.constraints.timeLimit * 1000);

    const [exitResult] = await Promise.all([container.wait(), streamPromise]);

    const endTime = performance.now();
    clearTimeout(timeoutHandle);

    const timeUsed = parseFloat(((endTime - startTime) / 1000).toFixed(3)); // seconds

    // Docker stats
    let memoryUsed = 0;
    try {
      const stats = await container.stats({ stream: false });
      memoryUsed = stats.memory_stats?.usage
        ? Math.round(stats.memory_stats.usage / (1024 * 1024))
        : 0;
    } catch {}

    const cleanOutput = output.replace(/[^\x20-\x7E]+/g, "").trim();
    const exitCode = exitResult.StatusCode;

    if (wasKilled || timeUsed > config.constraints.timeLimit) {
      return {
        verdict: "TLE",
        output: "Time Limit Exceeded",
        timeUsed,
        memoryUsed,
      };
    }

    if (exitCode === 137) {
      return {
        verdict: "MLE",
        output: "Memory Limit Exceeded",
        timeUsed,
        memoryUsed,
      };
    }

    if (exitCode !== 0) {
      return {
        verdict: "RTE",
        output: "Runtime Error",
        timeUsed,
        memoryUsed,
      };
    }

    return {
      verdict: "OK",
      output: cleanOutput,
      timeUsed,
      memoryUsed,
    };
  } finally {
    try {
        if (fs.existsSync(codeFilePath)) {
            fs.unlinkSync(codeFilePath);
          }
              if (fs.existsSync(inputFilePath)) {
                fs.unlinkSync(inputFilePath);
              }
      if (container) {
        await container.stop().catch(() => {});
        await container.remove({ force: true }).catch(() => {});
      }
    } catch (error) {
      console.error("Cleanup error:", error);
    }
    clearTimeout(timeoutHandle);
  }
}

module.exports = { executeCode };
