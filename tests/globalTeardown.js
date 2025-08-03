// Global teardown that runs only once after all test suites complete
const { cleanTmpDir } = require("../src/fileUtils");
const queueManager = require("../src/queue_manager");

module.exports = async () => {
  console.log("Cleaning up tmp directory after all tests...");

  // Wait for all pending queue operations to complete
  console.log("Waiting for pending queue operations to complete...");
  await queueManager.waitForCompletion();

  cleanTmpDir();
};
