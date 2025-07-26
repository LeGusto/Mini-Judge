// Global teardown that runs only once after all test suites complete
const { cleanTmpDir } = require("../src/fileUtils");

module.exports = async () => {
  console.log("Cleaning up tmp directory after all tests...");
  cleanTmpDir();
};
