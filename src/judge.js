const docker = require("dockerode")();
const config = require("./config");

const LANGUAGE_CONFIG = {
  python: {
    image: "python:3.12-slim",
    cmd: (code) => ["python", "-c", code],
  },

  cpp: {
    image: "gcc:4.9",
    cmd: (code) => [
      "bash",
      "-c",
      `echo "${code}" > main.cpp && g++ main.cpp -o main && ./main`,
    ],
  },
};

async function executeCode({ code, language, input, problemId }) {
  if (!LANGUAGE_CONFIG[language]) {
    throw new Error("Unsupported language");
  }

  // Pull the Docker image, destroy stream after pulling
  // await new Promise((resolve, reject) => {
  //   docker.pull(LANGUAGE_CONFIG[language].image, (err, pullStream) => {
  //     if (err) return reject(err);

  //     docker.modem.followProgress(pullStream, (err /*, output*/) => {
  //       if (err) return reject(err);

  //       // when followProgress emits its “end” callback, destroy the stream
  //       pullStream.destroy();
  //       resolve();
  //     });
  //   });
  // });

  // console.log(`Docker image pulled: ${LANGUAGE_CONFIG[language].image}`);

  const container = await docker.createContainer({
    Image: LANGUAGE_CONFIG[language].image,
    Cmd: LANGUAGE_CONFIG[language].cmd(code),
    AttachStdout: true,
    AttachStderr: true,
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
    await container.start();
    // console.log(`Container started with ID: ${container.id}`);

    // Capture output
    let output = "";
    const stream = await container.attach({
      stream: true,
      stdout: true,
      stderr: true,
      logs: true,
    });

    // Create a promise to handle stream completion
    const streamPromise = new Promise((resolve) => {
      stream.on("data", (chunk) => (output += chunk.toString()));
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
    if (exitCode !== 0)
      return { verdict: "RTE", output: "Runtime Error", timeUsed, memoryUsed };

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
