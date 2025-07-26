const path = require("path");

// Normalize the output text
function normalize(text) {
  return text
    .trim()
    .replace(/\r\n/g, "\n") // Normalize line endings
    .replace(/[ \t]+\n/g, "\n") // Remove trailing whitespace on lines
    .replace(/\s+$/g, ""); // Remove trailing blank lines
}

// Get the verdict
function getVerdict(result, expectedOutput, checkerPath) {
  if (result.verdict === "TLE") {
    return "Time Limit Exceeded";
  }

  if (result.verdict === "MLE") {
    return "Memory Limit Exceeded";
  }

  if (result.verdict === "RTE") {
    return "Runtime Error";
  }

  const actual = normalize(result.output || "");
  const expected = normalize(expectedOutput || "");

  // Initialize the checker
  let checker;
  if (checkerPath) {
    if (!path.isAbsolute(checkerPath)) {
      checkerPath = path.join(__dirname, "..", checkerPath);
    }
    checker = require(checkerPath);
  }

  // If the checker is provided and returns true, return "Accepted"
  if (checker && checker(actual, expected)) {
    return "Accepted";
  }

  if (actual === expected) {
    return "Accepted";
  }

  return "Wrong Answer";
}

module.exports = { getVerdict };
