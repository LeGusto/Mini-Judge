const docker = require("dockerode")();
const path = require("path");
const fs = require("fs");
const tar = require("tar");
const os = require("os");
const { performance } = require("perf_hooks");

// Container pool for consistent performance
const containerPool = {
  python: null,
  cpp: null,
  lastUsed: {}
};

// Pre-warm containers for consistent startup times
async function prewarmContainers() {
  console.log("Pre-warming containers for consistent performance...");
  
  for (const language of ['python', 'cpp']) {
    try {
      const container = await docker.createContainer({
        Image: LANGUAGE_CONFIG[language].image,
        Cmd: ["sleep", "infinity"], // Keep container alive
        AttachStdout: true,
        AttachStderr: true,
        AttachStdin: true,
        Tty: false,
        HostConfig: {
          Memory: 512 * 1024 * 1024, // 512MB default
          CpuPeriod: 100000,
          CpuQuota: 200000, // 2 seconds default
          CpusetCpus: "0",
          AutoRemove: false, // Don't auto-remove pre-warmed containers
          NetworkMode: "none",
          MemorySwap: 0,
          IpcMode: "private",
          PidMode: "host",
          Privileged: false,
          ReadonlyRootfs: true,
          SecurityOpt: ["no-new-privileges"],
          CapDrop: ["ALL"],
          Tmpfs: {
            "/tmp": "size=100m,noexec,nosuid,nodev"
          }
        },
      });
      
      await container.start();
      containerPool[language] = container;
      containerPool.lastUsed[language] = Date.now();
      console.log(`Pre-warmed ${language} container`);
    } catch (err) {
      console.warn(`Failed to pre-warm ${language} container:`, err.message);
    }
  }
}

// Clean up pre-warmed containers
async function cleanupContainerPool() {
  for (const language of ['python', 'cpp']) {
    if (containerPool[language]) {
      try {
        await containerPool[language].stop();
        await containerPool[language].remove();
        containerPool[language] = null;
      } catch (err) {
        console.error(`Failed to cleanup ${language} container:`, err.message);
      }
    }
  }
}

// Get or create container for execution
async function getContainer(language, constraints) {
  // Use pre-warmed container if available and recent
  const now = Date.now();
  const timeSinceLastUse = now - (containerPool.lastUsed[language] || 0);
  
  if (containerPool[language] && timeSinceLastUse < 30000) { // 30 seconds
    containerPool.lastUsed[language] = now;
    return containerPool[language];
  }
  
  // Create new container with specific constraints
  return await docker.createContainer({
    Image: LANGUAGE_CONFIG[language].image,
    Cmd: ["sleep", "infinity"],
    AttachStdout: true,
    AttachStderr: true,
    AttachStdin: true,
    Tty: false,
    HostConfig: {
      Memory: constraints.memoryLimit * 1024 * 1024,
      CpuPeriod: 100000,
      CpuQuota: constraints.timeLimit * 100000,
      CpusetCpus: "0",
      AutoRemove: true,
      NetworkMode: "none",
      MemorySwap: 0,
      IpcMode: "private",
      PidMode: "host",
      Privileged: false,
      ReadonlyRootfs: true,
      SecurityOpt: ["no-new-privileges"],
      CapDrop: ["ALL"],
      Tmpfs: {
        "/tmp": "size=100m,noexec,nosuid,nodev"
      }
    },
  });
}

function createTarStream(filePaths) {
  const tmpFolder = fs.mkdtempSync(path.join(os.tmpdir(), "judge-"));
  const tempPaths = [];

  for (const originalPath of filePaths) {
    const baseName = path.basename(originalPath);
    const tempTarget = path.join(tmpFolder, baseName);
    fs.copyFileSync(originalPath, tempTarget);
    tempPaths.push(tempTarget);
  }

  return tar.create({ cwd: tmpFolder }, tempPaths.map(p => path.basename(p)));
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

async function executeCode({ codeFilename, language, inputFiles = [], constraints }) {
  if (!LANGUAGE_CONFIG[language]) {
    throw new Error("Unsupported language");
  }

  const tmpDir = path.join(path.dirname(__dirname), "tmp");
  const codeFilePath = path.join(tmpDir, codeFilename);
  if (!fs.existsSync(codeFilePath)) {
    throw new Error(`Code file does not exist: ${codeFilePath}`);
  }

  const results = [];

  for (let i = 0; i < constraints.tests; i++) {
    const input = i < inputFiles.length ? inputFiles[i] : null;
    const inputFilePath = input?.absolutePath || null;

    const container = await getContainer(language, constraints);

    let timeoutHandle;
    let wasKilled = false;

    try {
      const filesToTransfer = inputFilePath
        ? [codeFilePath, inputFilePath]
        : [codeFilePath];

      const tarStream = createTarStream(filesToTransfer);
      await container.putArchive(tarStream, { path: "/" });
      
      // Execute the command in the container
      const exec = await container.exec({
        Cmd: LANGUAGE_CONFIG[language].cmd(
          path.basename(codeFilename),
          inputFilePath ? path.basename(inputFilePath) : null
        ),
        AttachStdout: true,
        AttachStderr: true,
        AttachStdin: true,
        Tty: false,
      });

      const stream = await exec.start({
        stdin: true,
        stdout: true,
        stderr: true,
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

      const startTime = performance.now();
      timeoutHandle = setTimeout(() => {
        wasKilled = true;
        exec.kill().catch(() => {});
      }, constraints.timeLimit * 1000);

      const [exitResult] = await Promise.all([exec.wait(), streamPromise]);

      const endTime = performance.now();
      clearTimeout(timeoutHandle);

      const timeUsed = parseFloat(((endTime - startTime) / 1000).toFixed(3));

      let memoryUsed = 0;
      try {
        const stats = await container.stats({ stream: false });
        memoryUsed = stats.memory_stats?.usage
          ? Math.round(stats.memory_stats.usage / (1024 * 1024))
          : 0;
      } catch {}

      const cleanOutput = output.replace(/[^\x20-\x7E]+/g, "").trim();
      const exitCode = exitResult.StatusCode;

      let verdict = "OK";
      let finalOutput = cleanOutput;

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

      results.push({
        input: input?.filename,
        verdict,
        output: finalOutput,
        timeUsed,
        memoryUsed,
      });
    } finally {
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
      clearTimeout(timeoutHandle);
    }
  }

  // Clean up uploaded code file
  if (codeFilePath.includes("/tmp/") && fs.existsSync(codeFilePath)) {
    fs.unlinkSync(codeFilePath);
  }

  return results;
}

module.exports = { executeCode, prewarmContainers, cleanupContainerPool };
