const { executeCode } = require("./judge");
const { getVerdict } = require("./verdict");
const path = require("path");
const fs = require("fs");

// Queue manager class
class QueueManager {
  constructor() {
    this.queue = [];
    this.submissions = new Map();
    this.maxWorkers = 3;
    this.activeWorkers = 0;
    this.submissionCounter = 0;
  }

  // Generate a submission ID
  generateSubmissionId() {
    return `sub_${Date.now()}_${++this.submissionCounter}`;
  }

  // Add a submission to the queue
  async addSubmission(submission) {
    const submissionId = this.generateSubmissionId();

    // Create submission data
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

    // Add submission to the submissions map
    this.submissions.set(submissionId, submissionData);
    this.queue.push(submissionId);

    // Start processing if not at capacity
    if (this.activeWorkers < this.maxWorkers) {
      this.processNext();
    }

    return submissionId;
  }

  // Process the next submission in the queue
  async processNext() {
    if (this.queue.length === 0 || this.activeWorkers >= this.maxWorkers) {
      return;
    }

    // Get the next submission Id in the queue
    const submissionId = this.queue.shift();
    this.activeWorkers++;

    try {
      // Get the submission
      const submission = this.submissions.get(submissionId);
      submission.status = "processing";
      submission.progress = 10;

      // Get problem data
      const problemDir = path.join("problems", submission.problemID);
      const inputDir = path.join(problemDir, "input");
      const outputDir = path.join(problemDir, "output");
      const dataJsonPath = path.join(problemDir, "data.json");

      // Check if the output directory exists
      if (!fs.existsSync(outputDir)) {
        throw new Error("Problem output directory not found");
      }

      // Check if the data.json file exists
      if (!fs.existsSync(dataJsonPath)) {
        throw new Error("Missing data.json in problem folder");
      }

      submission.progress = 20;

      // Initialize storage for input files
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

      // Get constraints from data.json
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

      // Process results and determine verdicts
      const results = executionResults.map((result) => {
        // If the input file exists, use it
        if (result.input) {
          const outputPath = path.join(
            outputDir,
            result.input.replace(".in", ".out")
          );
          // Check if the output file exists
          if (!fs.existsSync(outputPath)) {
            return {
              test: result.input,
              verdict: "Missing Output File",
            };
          }

          // Read the expected output
          expectedOutput = fs.readFileSync(outputPath, "utf8");
        } else {
          // If the input file does not exist, use the test number
          const outputPath = path.join(outputDir, result.test + ".out");

          // Check if the output file exists
          if (!fs.existsSync(outputPath)) {
            return {
              test: result.test,
              verdict: "Missing Output File",
            };
          }

          // Read the expected output
          expectedOutput = fs.readFileSync(outputPath, "utf8");
        }

        // Get the checker path (custom output checker)
        const checkerPath = path.join(problemDir, "checker.js");

        // Get the verdict
        const verdict = getVerdict(result, expectedOutput, checkerPath);

        // Return the result
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
      // Update submission status to error
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

  // Get the status of a submission
  getSubmissionStatus(submissionId) {
    return this.submissions.get(submissionId) || null;
  }

  // Get all submissions
  getAllSubmissions() {
    return Array.from(this.submissions.values()).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
  }

  // Get the stats of the queue
  getQueueStats() {
    return {
      queueLength: this.queue.length,
      activeWorkers: this.activeWorkers,
      maxWorkers: this.maxWorkers,
      totalSubmissions: this.submissions.size,
    };
  }

  // Clean up old submissions (keep last 100)
  // cleanup() {
  //   const submissions = this.getAllSubmissions();
  //   if (submissions.length > 100) {
  //     const toRemove = submissions.slice(100);
  //     toRemove.forEach((sub) => {
  //       this.submissions.delete(sub.id);
  //     });
  //   }
  // }
}

// Create a singleton instance
const queueManager = new QueueManager();

// Cleanup old submissions every 10 minutes
// const cleanupInterval = setInterval(() => {
//   queueManager.cleanup();
// }, 10 * 60 * 1000);

// Export cleanup function for tests
// queueManager.stopCleanup = () => {
//   clearInterval(cleanupInterval);
// };

module.exports = queueManager;
