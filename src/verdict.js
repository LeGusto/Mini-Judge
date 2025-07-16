const config = require("../config");

function normalize(text) {
  return text
    .trim()
    .replace(/\r\n/g, "\n") // Normalize line endings
    .replace(/[ \t]+\n/g, "\n") // Remove trailing whitespace on lines
    .replace(/\s+$/g, "") // Remove trailing blank lines
    .replace(/\s+/g, " "); // Optional: normalize all whitespace (careful!)
}

function getVerdict(result, expectedOutput) {
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

  if (actual === expected) {
    return "Accepted";
  }

  return "Wrong Answer";
}

module.exports = { getVerdict };
