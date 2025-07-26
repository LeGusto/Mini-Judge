const path = require("path");
const fs = require("fs");

// Import the actual queue manager
const queueManager = require("../src/queue_manager");

describe("QueueManager", () => {
  beforeEach(() => {
    // Clear the queue and submissions before each test
    queueManager.queue = [];
    queueManager.submissions.clear();
    queueManager.activeWorkers = 0;
    queueManager.submissionCounter = 0;

    // Ensure tmp directory exists
    const tmpDir = path.join(__dirname, "../tmp");
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    // Copy the existing solution file to tmp for testing (use problem 2 for speed)
    const sourceFile = path.join(__dirname, "../problems/2/sol.cpp");
    const targetFile = path.join(tmpDir, "sol.cpp");
    fs.copyFileSync(sourceFile, targetFile);
  });

  test("should add submission to queue", async () => {
    const submission = {
      language: "cpp",
      problemID: "2",
      codeFilename: "sol.cpp",
    };

    const submissionId = await queueManager.addSubmission(submission);

    expect(submissionId).toBeDefined();
    expect(submissionId).toMatch(/^sub_\d+_\d+$/);

    // Check status immediately after adding to queue
    const submissionData = queueManager.getSubmissionStatus(submissionId);
    expect(submissionData).toBeDefined();
    expect(submissionData.language).toBe("cpp");
    expect(submissionData.problemID).toBe("2");
  });

  test("should queue submissions when workers are busy", async () => {
    const tmpDir = path.join(__dirname, "../tmp");

    // Copy the solution file multiple times for busy workers
    for (let i = 0; i < queueManager.maxWorkers; i++) {
      const sourceFile = path.join(__dirname, "../problems/2/sol.cpp");
      const targetFile = path.join(tmpDir, `busy${i}.cpp`);
      fs.copyFileSync(sourceFile, targetFile);
    }

    // Fill up all workers first with real submissions
    const busySubmissions = [];
    for (let i = 0; i < queueManager.maxWorkers; i++) {
      const submissionId = await queueManager.addSubmission({
        language: "cpp",
        problemID: "2",
        codeFilename: `busy${i}.cpp`,
      });
      busySubmissions.push(submissionId);
    }

    // Wait a moment for workers to start processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check that workers are busy
    expect(queueManager.activeWorkers).toBe(queueManager.maxWorkers);

    // Copy file for queued submission
    const sourceFile = path.join(__dirname, "../problems/2/sol.cpp");
    const queuedFile = path.join(tmpDir, "queued.cpp");
    fs.copyFileSync(sourceFile, queuedFile);

    // Now add another submission - it should be queued
    const queuedSubmissionId = await queueManager.addSubmission({
      language: "cpp",
      problemID: "2",
      codeFilename: "queued.cpp",
    });

    const queuedSubmissionData =
      queueManager.getSubmissionStatus(queuedSubmissionId);
    expect(queuedSubmissionData.status).toBe("queued");
    expect(queueManager.queue.length).toBe(1);
  });

  test("should process submissions in queue", async () => {
    const submissionId = await queueManager.addSubmission({
      language: "cpp",
      problemID: "2",
      codeFilename: "sol.cpp",
    });

    // Wait for processing to complete (problem 2 is faster)
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const submissionData = queueManager.getSubmissionStatus(submissionId);
    expect(submissionData.status).toBe("completed");
    expect(submissionData.results).toBeDefined();
    expect(submissionData.summary).toBeDefined();
  });

  test("should limit concurrent workers", async () => {
    const tmpDir = path.join(__dirname, "../tmp");

    // Copy the solution file multiple times
    for (let i = 0; i < queueManager.maxWorkers + 2; i++) {
      const sourceFile = path.join(__dirname, "../problems/2/sol.cpp");
      const targetFile = path.join(tmpDir, `test${i}.cpp`);
      fs.copyFileSync(sourceFile, targetFile);
    }

    // Submit more than max workers
    const submissions = [];
    for (let i = 0; i < queueManager.maxWorkers + 2; i++) {
      const submissionId = await queueManager.addSubmission({
        language: "cpp",
        problemID: "2",
        codeFilename: `test${i}.cpp`,
      });
      submissions.push(submissionId);
    }

    // Wait for all to complete (problem 2 is faster)
    await new Promise((resolve) => setTimeout(resolve, 8000));

    // Check that all submissions completed
    for (const submissionId of submissions) {
      const submissionData = queueManager.getSubmissionStatus(submissionId);
      expect(submissionData.status).toBe("completed");
    }
  });

  test("should handle submission errors gracefully", async () => {
    const submissionId = await queueManager.addSubmission({
      language: "cpp",
      problemID: "2",
      codeFilename: "sol.cpp",
    });

    // Wait for processing to complete (problem 2 is faster)
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const submissionData = queueManager.getSubmissionStatus(submissionId);
    expect(submissionData.status).toBe("completed");
  });
});
