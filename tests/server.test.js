const request = require("supertest");
const path = require("path");
const fs = require("fs-extra");
const app = require("../src/server"); // assuming server.js exports your app

jest.mock("../src/judge", () => ({
  executeCode: jest.fn(() =>
    Promise.resolve([
      {
        input: "1.in",
        timeUsed: 0.1,
        memoryUsed: 256,
        stdout: "Hello, World!\n",
      },
      {
        input: "2.in",
        timeUsed: 0.12,
        memoryUsed: 128,
        stdout: "Hello, World!\n",
      },
      {
        input: "3.in",
        timeUsed: 0.08,
        memoryUsed: 100,
        stdout: "Hello, World!\n",
      },
    ])
  ),
}));

jest.mock("../src/verdict", () => ({
  getVerdict: jest.fn(() => "Accepted"),
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

  test("should process all tests defined in constraints", async () => {
    const res = await request(app)
      .post("/judge")
      .field("language", "cpp")
      .field("problemID", problemID)
      .attach("code", Buffer.from("// dummy cpp code"), "main.cpp");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("summary");
    expect(res.body.summary.total).toBe(3);
    expect(res.body.summary.passed).toBe(3);
    expect(res.body.results).toHaveLength(3);
    expect(res.body.results.every(r => r.verdict === "Accepted")).toBe(true);
  });
});
