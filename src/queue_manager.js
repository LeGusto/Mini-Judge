const { executeCode } = require("./judge");
const { getVerdict } = require("./verdict");
const path = require("path");
const fs = require("fs");

class QueueManager {
  constructor() {
    this.queue = [];
    this.submissions = new Map();
    this.maxWorkers = 3;
    this.activeWorkers = 0;
    this.submissionCounter = 0;
  }

  generateSubmissionId() {
    return `sub_${Date.now()}_${++this.submissionCounter}`;
  }

  async addSubmission(submission) {
    const submissionId = this.generateSubmissionId();

    const submissionData = {
      id: submissionId,
      status: "queued",
      progress: 0,
      language: submission.language,
      problemID: submission.problemID,
      codeFilename: submission.codeFilename,
      createdAt: new Date(),
      results: null,
      error: null,
    };

    this.submissions.set(submissionId, submissionData);
    this.queue.push(submissionId);

    // Start processing if not at capacity
    if (this.activeWorkers < this.maxWorkers) {
      this.processNext();
    }

    return submissionId;
  }

  async processNext() {
    if (this.queue.length === 0 || this.activeWorkers >= this.maxWorkers) {
      return;
    }

    const submissionId = this.queue.shift();
    this.activeWorkers++;

    try {
      const submission = this.submissions.get(submissionId);
      submission.status = "processing";
      submission.progress = 10;

      // Get problem data
      const problemDir = path.join("problems", submission.problemID);
      const inputDir = path.join(problemDir, "input");
      const outputDir = path.join(problemDir, "output");
      const dataJsonPath = path.join(problemDir, "data.json");

      if (!fs.existsSync(outputDir)) {
        throw new Error("Problem output directory not found");
      }

      if (!fs.existsSync(dataJsonPath)) {
        throw new Error("Missing data.json in problem folder");
      }

      submission.progress = 20;
      let inputFileObjs = [];

      // Build input files list
      if (fs.existsSync(inputDir)) {
        const inputFiles = fs
          .readdirSync(inputDir)
          .filter((f) => f.endsWith(".in"))
          .sort();
        inputFileObjs = inputFiles.map((file) => {
          const fullPath = path.join(inputDir, file);
          return {
            filename: path.basename(file),
            absolutePath: fullPath,
          };
        });
      }

      submission.progress = 30;

      // Get constraints
      const constraints = JSON.parse(fs.readFileSync(dataJsonPath, "utf8"));
      const timeLimit = parseFloat(constraints.time_limit);
      const memoryLimit = parseInt(constraints.memory_limit);
      const tests = parseInt(constraints.tests);

      submission.progress = 40;

      // Execute code
      const executionResults = await executeCode({
        codeFilename: submission.codeFilename,
        language: submission.language,
        inputFiles: inputFileObjs,
        constraints: {
          timeLimit,
          memoryLimit,
          tests,
        },
      });

      submission.progress = 70;

      let expectedOutput = null;
      console.log(problemDir);

      // Process results and determine verdicts
      const results = executionResults.map((result) => {
        if (result.input) {
          const outputPath = path.join(
            outputDir,
            result.input.replace(".in", ".out")
          );
          if (!fs.existsSync(outputPath)) {
            return {
              test: result.input,
              verdict: "Missing Output File",
            };
          }

          expectedOutput = fs.readFileSync(outputPath, "utf8");
        } else {
          const outputPath = path.join(outputDir, result.test + ".out");
          if (!fs.existsSync(outputPath)) {
            return {
              test: result.test,
              verdict: "Missing Output File",
            };
          }

          expectedOutput = fs.readFileSync(outputPath, "utf8");
        }
        const checkerPath = path.join(problemDir, "checker.js");

        const verdict = getVerdict(result, expectedOutput, checkerPath);

        return {
          test: result.input || result.test,
          verdict,
          time: result.timeUsed,
          memory: result.memoryUsed,
        };
      });

      submission.progress = 90;

      // Calculate summary
      const summary = {
        total: results.length,
        passed: results.filter((r) => r.verdict === "Accepted").length,
        failed: results.filter((r) => r.verdict !== "Accepted").length,
      };

      submission.progress = 100;
      submission.status = "completed";
      submission.results = results;
      submission.summary = summary;
      submission.completedAt = new Date();
    } catch (error) {
      const submission = this.submissions.get(submissionId);
      submission.status = "error";
      submission.error = error.message;
      submission.completedAt = new Date();
      console.error(`Submission ${submissionId} failed:`, error);
    } finally {
      this.activeWorkers--;
      // Process next submission in queue
      setImmediate(() => this.processNext());
    }
  }

  getSubmissionStatus(submissionId) {
    return this.submissions.get(submissionId) || null;
  }

  getAllSubmissions() {
    return Array.from(this.submissions.values()).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
  }

  getQueueStats() {
    return {
      queueLength: this.queue.length,
      activeWorkers: this.activeWorkers,
      maxWorkers: this.maxWorkers,
      totalSubmissions: this.submissions.size,
    };
  }

  // Clean up old submissions (keep last 100)
  cleanup() {
    const submissions = this.getAllSubmissions();
    if (submissions.length > 100) {
      const toRemove = submissions.slice(100);
      toRemove.forEach((sub) => {
        this.submissions.delete(sub.id);
      });
    }
  }
}

// Create singleton instance
const queueManager = new QueueManager();

// Cleanup old submissions every 10 minutes
const cleanupInterval = setInterval(() => {
  queueManager.cleanup();
}, 10 * 60 * 1000);

// Export cleanup function for tests
queueManager.stopCleanup = () => {
  clearInterval(cleanupInterval);
};

module.exports = queueManager;
