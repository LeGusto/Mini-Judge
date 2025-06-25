getVerdict = (result, expectedOutput) => {
  if (result.error) {
    return "Runtime Error";
  }

  if (result.time > constraints.timeLimit) {
    return "Time Limit Exceeded";
  }

  if (result.memory > constraints.memoryLimit) {
    return "Memory Limit Exceeded";
  }

  if (result.output.trim() === expectedOutput.trim()) {
    return "Accepted";
  }

  return "Wrong Answer";
};
