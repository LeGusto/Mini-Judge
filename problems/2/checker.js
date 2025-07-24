function check(output, answer) {
  // Split output and answer into arrays of numbers, sort, and compare
  const outputArr = output
    .trim()
    .split(/\s+/)
    .map(Number)
    .sort((a, b) => a - b);
  const answerArr = answer
    .trim()
    .split(/\s+/)
    .map(Number)
    .sort((a, b) => a - b);
  if (outputArr.length !== answerArr.length) return false;
  for (let i = 0; i < outputArr.length; i++) {
    if (outputArr[i] !== answerArr[i]) return false;
  }
  return true;
}

module.exports = check;
