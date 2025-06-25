const { Network } = require("inspector/promises");
const config = require("./config");

const LANGUAGE_CONFIG = {
  python: {
    image: "python:3.9-slim",
    cmd: (code) => ["python", "-c", code],
  },
};

// problemId is meant for fetching problem-specific constraints if needed
// input is also optional if needed for the specific problem
async function executeCode({ code, language, input, problemId }) {
  // Only allow Python for now
  if (language !== "python") {
    throw new Error("Unsupported language");
  }

  const container = await docker.createContainer({
    Image: LANGUAGE_CONFIG[language].image,
    Cmd: LANGUAGE_CONFIG[language].cmd(code),
    AttachStdout: true,
    AttachStderr: true,
    HostConfig: {
      Memory: config.constraints.memoryLimit * 1024 * 1024, // Convert MB to bytes
      CpuQuota: config.constraints.timeLimit * 100000, // Convert seconds to CPU quota
      AutoRemove: true, // Destroy container after execution
      NetworkMode: "none", // Disable network access
      MemorySwap: 0, // Disable swap memory
    },
  });

  try {
    // Start container with timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("TLE")), constraints.time * 1000)
    );

    await container.start();

    // Attach to container stream
    const stream = await container.attach({
      stream: true,
      stdout: true,
      stderr: true,
    });

    let output = "";
    stream.on("data", (chunk) => (output += chunk.toString()));

    // Wait for execution to finish
    const exitCode = (await container.wait()).StatusCode;
    const stats = await container.stats();
    const memoryUsed = Math.round(stats.memory_stats.usage / (1024 * 1024)); // in MB
    const timeUsed = parseFloat(
      (stats.cpu_stats.cpu_usage.total_usage / 1e9).toFixed(2)
    );

    // Handle errors

    if (exitCode === 137) {
      // 137 = SIGKILL (memory limit)
      return {
        verdict: "MLE",
        output: "Memory Limit Exceeded",
        timeUsed,
        memoryUsed,
      };
    }

    if (exitCode === 124) {
      // 124 = timeout (CPU limit)
      return {
        verdict: "TLE",
        output: "Time Limit Exceeded",
        timeUsed,
        memoryUsed,
      };
    }

    if (exitCode !== 0) {
      // General runtime error
      return {
        verdict: "RTE",
        output: "Runtime Error",
        timeUsed,
        memoryUsed,
      };
    }

    return {
      output,
      timeUsed,
      memoryUsed,
    };
  } catch (error) {
    throw error;
  }
}

module.exports = { executeCode };
