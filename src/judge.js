const docker = require("dockerode")();
const config = require("./config");
const path = require("path");

// Used to transfer files from tmp to the container
function createTarStream(filePaths) {
  const dir = path.dirname(filePaths[0]);
  const files = filePaths.map((f) => path.basename(f));
  return tar.pack(dir, {
    entries: files, // only include these files
  });
}

const LANGUAGE_CONFIG = {
  python: {
    image: "python:3.12-slim",

    cmd: (codeFilePath, inputFilePath) => {
      if (inputFilePath) {
        return ["bash", "-c", `python ${codeFilePath} < ${inputFilePath}`];
      }
      return ["python", codeFilePath];
    },
  },

  // uses C++17 by default
  cpp: {
    image: "gcc:12",
    cmd: (codeFilePath, inputFilePath) => {
      // if (input) {
      //   return [
      //     "bash",
      //     "-c",
      //     `echo "${code}" > main.cpp && g++ main.cpp -o main && ./main  <<< "${input}"`,
      //   ];
      // }
      // return [
      //   "bash",
      //   "-c",
      //   `echo "${code}" > main.cpp && g++ main.cpp -o main && ./main`,
      // ];'  const run = inputFilePath
      const run = inputFilePath ? `./main < ${inputFilePath}` : `./main`;
      return ["bash", "-c", `g++ ${codeFilePath} -o main && ${run}`];
    },
  },
};

async function executeCode({
  codeFilePath,
  language,
  inputFilePath,
  problemId,
}) {
  if (!LANGUAGE_CONFIG[language]) {
    throw new Error("Unsupported language");
  }

  const container = await docker.createContainer({
    Image: LANGUAGE_CONFIG[language].image,
    Cmd: LANGUAGE_CONFIG[language].cmd(codeFilePath, inputFilePath),
    AttachStdout: true,
    AttachStderr: true,
    AttachStdin: true,
    Tty: false,
    HostConfig: {
      Memory: config.constraints.memoryLimit * 1024 * 1024,
      CpuQuota: config.constraints.timeLimit * 100000,
      AutoRemove: true,
      NetworkMode: "none",
      MemorySwap: 0,
    },
  });

  // console.log(
  //   `Container created with ID: ${container.id} and language: ${language}`
  // );

  try {
    // Put the necessary files into the container before starting it
    console.log(codeFilePath);
    const tarStream = createTarStream([codeFilePath]);
    await container.putArchive(tarStream, { path: "/app" }); // inside container

    await container.start();
    // console.log(`Container started with ID: ${container.id}`);

    // Capture output
    let output = "";
    const stream = await container.attach({
      stream: true,
      stdin: true,
      stdout: true,
      stderr: true,
      logs: true,
    });

    // Create a promise to handle stream completion
    const streamPromise = new Promise((resolve) => {
      // Note to self: The first 8 bytes of the chunker are a header
      stream.on("data", (chunk) => {
        // stdout and stderr are mixed in the same stream
        if (chunk[0] <= 2) {
          // console.log(chunk);
          output += chunk.slice(8).toString();
        }
      });
      stream.on("end", resolve);
      stream.on("error", resolve);
    });

    // Wait for execution to finish and stream to end
    const [exitResult] = await Promise.all([container.wait(), streamPromise]);
    const exitCode = exitResult.StatusCode;

    // Get container stats
    const stats = await container.stats({ stream: false });
    const memoryUsed = stats.memory_stats?.usage
      ? Math.round(stats.memory_stats.usage / (1024 * 1024))
      : 0;
    const timeUsed = stats.cpu_stats?.cpu_usage?.total_usage
      ? parseFloat((stats.cpu_stats.cpu_usage.total_usage / 1e9).toFixed(2))
      : 0;

    // console.log(output);
    // Clean output
    const cleanOutput = output.replace(/[^\x20-\x7E]+/g, "").trim();
    // console.log("Cleaned output:", cleanOutput);

    // Handle exit codes
    if (exitCode === 137)
      return {
        verdict: "MLE",
        output: "Memory Limit Exceeded",
        timeUsed,
        memoryUsed,
      };
    if (exitCode === 124)
      return {
        verdict: "TLE",
        output: "Time Limit Exceeded",
        timeUsed,
        memoryUsed,
      };
    if (exitCode !== 0) {
      console.log("RTE: ", exitCode, output);
      return { verdict: "RTE", output: "Runtime Error", timeUsed, memoryUsed };
    }

    return { output: cleanOutput, timeUsed, memoryUsed };
  } finally {
    try {
      if (container) {
        await container.stop().catch(() => {});
        await container.remove({ force: true }).catch(() => {});
      }
    } catch (error) {
      console.error("Cleanup error:", error);
    }
  }
}

module.exports = { executeCode };
