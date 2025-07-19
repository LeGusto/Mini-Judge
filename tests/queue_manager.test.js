// Mock the judge module
jest.mock("../src/judge", () => ({
  executeCode: jest.fn(() =>
    new Promise(resolve => {
      // Simulate processing time
      setTimeout(() => {
        resolve([
          {
            input: "1.in",
            timeUsed: 0.1,
            memoryUsed: 256,
            stdout: "Hello, World!\n",
            verdict: "OK",
            output: "Hello, World!\n"
          }
        ]);
      }, 100); // 100ms delay to simulate processing
    })
  ),
}));

// Mock the verdict module
jest.mock("../src/verdict", () => ({
  getVerdict: jest.fn(() => "Accepted"),
}));

// Mock fs module
jest.mock("fs", () => ({
  existsSync: jest.fn((path) => {
    if (path.includes("input") || path.includes("output") || path.includes("data.json")) {
      return true;
    }
    return false;
  }),
  readdirSync: jest.fn(() => ["1.in", "2.in"]),
  readFileSync: jest.fn(() => JSON.stringify({
    time_limit: "2",
    memory_limit: "256",
    tests: "2"
  })),
}));

// Import after mocks
const queueManager = require("../src/queue_manager");

describe("QueueManager", () => {
  beforeEach(() => {
    // Clear the queue and submissions before each test
    queueManager.queue = [];
    queueManager.submissions.clear();
    queueManager.activeWorkers = 0;
    queueManager.submissionCounter = 0;
  });

  afterAll(() => {
    // Clean up the interval to prevent Jest from hanging
    if (queueManager.stopCleanup) {
      queueManager.stopCleanup();
    }
  });

  test("should add submission to queue", async () => {
    const submission = {
      language: "cpp",
      problemID: "test-problem",
      codeFilename: "test.cpp"
    };

    const submissionId = await queueManager.addSubmission(submission);
    
    expect(submissionId).toBeDefined();
    expect(submissionId).toMatch(/^sub_\d+_\d+$/);
    
    // Check status immediately after adding to queue
    const submissionData = queueManager.getSubmissionStatus(submissionId);
    expect(submissionData).toBeDefined();
    expect(submissionData.language).toBe("cpp");
    expect(submissionData.problemID).toBe("test-problem");
    
    // The status could be "queued" or "processing" depending on timing
    expect(["queued", "processing", "completed"]).toContain(submissionData.status);
    
    // Wait a bit for processing to complete
    await new Promise(resolve => setTimeout(resolve, 200));
  });

  test("should queue submissions when workers are busy", async () => {
    // Fill up all workers first
    const busySubmissions = [];
    for (let i = 0; i < queueManager.maxWorkers; i++) {
      const submissionId = await queueManager.addSubmission({
        language: "cpp",
        problemID: "test-problem",
        codeFilename: `busy${i}.cpp`
      });
      busySubmissions.push(submissionId);
    }
    
    // Wait a moment for workers to start processing
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Check that workers are busy
    expect(queueManager.activeWorkers).toBe(queueManager.maxWorkers);
    
    // Now add another submission - it should be queued
    const queuedSubmissionId = await queueManager.addSubmission({
      language: "cpp",
      problemID: "test-problem",
      codeFilename: "queued.cpp"
    });
    
    const queuedSubmission = queueManager.getSubmissionStatus(queuedSubmissionId);
    expect(queuedSubmission.status).toBe("queued");
    
    // Wait for all submissions to complete
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  test("should respect max workers limit", () => {
    expect(queueManager.maxWorkers).toBe(3);
    expect(queueManager.activeWorkers).toBe(0);
  });

  test("should add to queue when no workers available", async () => {
    // Manually set workers to max to simulate busy state
    queueManager.activeWorkers = queueManager.maxWorkers;
    
    const submissionId = await queueManager.addSubmission({
      language: "cpp",
      problemID: "test-problem",
      codeFilename: "queued.cpp"
    });
    
    const submission = queueManager.getSubmissionStatus(submissionId);
    expect(submission.status).toBe("queued");
    expect(queueManager.queue).toContain(submissionId);
    
    // Reset workers
    queueManager.activeWorkers = 0;
  });

  test("should process submissions in queue", async () => {
    const submission = {
      language: "cpp",
      problemID: "test-problem",
      codeFilename: "test.cpp"
    };

    const submissionId = await queueManager.addSubmission(submission);
    
    // Wait for processing to complete
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const submissionData = queueManager.getSubmissionStatus(submissionId);
    expect(submissionData.status).toBe("completed");
    expect(submissionData.results).toBeDefined();
    expect(submissionData.summary).toBeDefined();
  });

  test("should limit concurrent workers", async () => {
    // Add more submissions than max workers
    const submissions = [];
    for (let i = 0; i < 5; i++) {
      const submissionId = await queueManager.addSubmission({
        language: "cpp",
        problemID: "test-problem",
        codeFilename: `test${i}.cpp`
      });
      submissions.push(submissionId);
    }

    // Check that only maxWorkers are active
    expect(queueManager.activeWorkers).toBeLessThanOrEqual(queueManager.maxWorkers);
    
    // Wait for all to complete
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check that all submissions are completed
    for (const submissionId of submissions) {
      const submissionData = queueManager.getSubmissionStatus(submissionId);
      expect(submissionData.status).toBe("completed");
    }
  });

  test("should return queue statistics", () => {
    const stats = queueManager.getQueueStats();
    
    expect(stats).toHaveProperty("queueLength");
    expect(stats).toHaveProperty("activeWorkers");
    expect(stats).toHaveProperty("maxWorkers");
    expect(stats).toHaveProperty("totalSubmissions");
    expect(stats.maxWorkers).toBe(3);
  });

  test("should return null for non-existent submission", () => {
    const submission = queueManager.getSubmissionStatus("non-existent-id");
    expect(submission).toBeNull();
  });
}); 