const request = require("supertest");
const path = require("path");
const fs = require("fs-extra");
const app = require("../src/server");

jest.mock("../src/queue_manager", () => ({
  addSubmission: jest.fn(() => Promise.resolve("sub_1234567890_1")),
  getSubmissionStatus: jest.fn((id) => ({
    id,
    status: "completed",
    progress: 100,
    results: [
      { test: "1.in", verdict: "Accepted", time: 0.1, memory: 256 },
      { test: "2.in", verdict: "Accepted", time: 0.12, memory: 128 },
      { test: "3.in", verdict: "Accepted", time: 0.08, memory: 100 }
    ],
    summary: { total: 3, passed: 3, failed: 0 }
  })),
  getAllSubmissions: jest.fn(() => []),
  getQueueStats: jest.fn(() => ({
    queueLength: 0,
    activeWorkers: 0,
    maxWorkers: 3,
    totalSubmissions: 1
  }))
}));

describe("POST /judge with constraints.tests", () => {
  const problemID = "test-problem";
  const problemDir = path.join(process.cwd(), "problems", problemID);
  const inputDir = path.join(problemDir, "input");
  const outputDir = path.join(problemDir, "output");
  

  beforeAll(async () => {
    await fs.ensureDir(inputDir);
    await fs.ensureDir(outputDir);

    // Create input/output files for 3 tests
    for (let i = 1; i <= 3; i++) {
      await fs.writeFile(path.join(inputDir, `${i}.in`), `input ${i}`);
      await fs.writeFile(path.join(outputDir, `${i}.out`), "Hello, World!\n");
    }

    await fs.writeFile(
      path.join(problemDir, "data.json"),
      JSON.stringify({
        time_limit: 2.0,
        memory_limit: 512,
        tests: 3,
      })
    );
  });

  afterAll(async () => {
    await fs.remove(problemDir);
  });

  test("should add submission to queue", async () => {
    const res = await request(app)
      .post("/judge")
      .field("language", "cpp")
      .field("problemID", problemID)
      .attach("code", Buffer.from("// dummy cpp code"), "main.cpp");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("submissionId");
    expect(res.body).toHaveProperty("status");
    expect(res.body.status).toBe("queued");
  });

  test("should get submission status", async () => {
    const res = await request(app)
      .get("/submission/sub_1234567890_1");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status");
    expect(res.body).toHaveProperty("results");
    expect(res.body).toHaveProperty("summary");
  });

  test("should handle real problem submission", async () => {
    const res = await request(app)
      .post("/judge")
      .field("language", "cpp")
      .field("problemID", "1")
      .attach("code", path.join(process.cwd(), "problems/1/sol.cpp"), "sol.cpp");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("submissionId");
    expect(res.body).toHaveProperty("status");
    expect(res.body.status).toBe("queued");
  });

});
