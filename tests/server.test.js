const request = require("supertest");
const path = require("path");

// Use the global server from setup.js
const app = require("../src/server");

describe("Server Endpoints", () => {
  test("should add submission to queue", async () => {
    const res = await request(app)
      .post("/judge")
      .field("language", "cpp")
      .field("problemID", "1")
      .attach(
        "code",
        path.join(__dirname, "../tests/code/cpp/test1/main.cpp"),
        "main.cpp"
      );

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("submissionId");
    expect(res.body).toHaveProperty("status");
    expect(res.body.status).toBe("queued");
  });

  test("should get submission status", async () => {
    // First create a submission
    const submitRes = await request(app)
      .post("/judge")
      .field("language", "cpp")
      .field("problemID", "1")
      .attach(
        "code",
        path.join(__dirname, "../tests/code/cpp/test1/main.cpp"),
        "main.cpp"
      );

    const submissionId = submitRes.body.submissionId;

    // Wait a bit for processing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Then check its status
    const res = await request(app).get(`/submission/${submissionId}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status");
  });

  test("should handle python submission", async () => {
    const res = await request(app)
      .post("/judge")
      .field("language", "python")
      .field("problemID", "1")
      .attach(
        "code",
        path.join(__dirname, "../tests/code/python/test1/main.py"),
        "main.py"
      );

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("submissionId");
    expect(res.body).toHaveProperty("status");
    expect(res.body.status).toBe("queued");
  });
});
