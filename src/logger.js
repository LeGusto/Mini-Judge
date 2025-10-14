// Simple logger module for the judge server

const logInfo = (msg) => {
  console.log(`[INFO] ${new Date().toISOString()} - ${msg}`);
};

const logError = (msg) => {
  console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`);
};

const logRequest = (method, path, status, duration) => {
  console.log(`[REQUEST] ${method} ${path} - ${status} - ${duration}ms`);
};

const logSubmission = (id, status, details) => {
  console.log(`[SUBMISSION] ${id} - ${status} - ${details}`);
};

const logJudge = (submissionId, testNum, verdict, time, memory) => {
  console.log(
    `[JUDGE] ${submissionId} - Test ${testNum}: ${verdict} (${time}s, ${memory}B)`
  );
};

module.exports = {
  logInfo,
  logError,
  logRequest,
  logSubmission,
  logJudge,
};
