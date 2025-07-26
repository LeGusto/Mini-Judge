const request = require("supertest");
const path = require("path");
const fs = require("fs");
const app = require("../src/server");
const { validateCodeFile } = require("../src/validation");

describe("Validation Tests", () => {
  describe("Zod Schema Validation", () => {
    test("should accept valid judge submission", async () => {
      const response = await request(app)
        .post("/judge")
        .field("language", "python")
        .field("problemID", "1")
        .attach("code", path.join(__dirname, "code/python/test1/main.py"));

      // Should not return 400 for validation errors
      expect(response.status).not.toBe(400);
    });

    test("should reject invalid language", async () => {
      const response = await request(app)
        .post("/judge")
        .field("language", "javascript") // Invalid language
        .field("problemID", "1")
        .attach("code", path.join(__dirname, "code/python/test1/main.py"));

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
      expect(response.body.details).toHaveLength(1);
      expect(response.body.details[0].field).toBe("language");
    });

    test("should reject empty problemID", async () => {
      const response = await request(app)
        .post("/judge")
        .field("language", "python")
        .field("problemID", "") // Empty problemID
        .attach("code", path.join(__dirname, "code/python/test1/main.py"));

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
      expect(response.body.details).toHaveLength(1);
      expect(response.body.details[0].field).toBe("problemID");
    });

    test("should reject missing problemID", async () => {
      const response = await request(app)
        .post("/judge")
        .field("language", "python")
        // Missing problemID
        .attach("code", path.join(__dirname, "code/python/test1/main.py"));

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Validation failed");
      expect(response.body.details).toHaveLength(1);
      expect(response.body.details[0].field).toBe("problemID");
    });
  });

  describe("File Validation", () => {
    test("should reject file larger than 1MB", async () => {
      // Create a large file (1.1MB)
      const largeFilePath = path.join(__dirname, "large_file.py");
      const largeContent = 'print("Hello")'.repeat(100000); // ~1.1MB
      fs.writeFileSync(largeFilePath, largeContent);

      try {
        const response = await request(app)
          .post("/judge")
          .field("language", "python")
          .field("problemID", "1")
          .attach("code", largeFilePath);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Code file too large (max 1MB)");
      } finally {
        // Clean up
        if (fs.existsSync(largeFilePath)) {
          fs.unlinkSync(largeFilePath);
        }
      }
    });

    test("should reject wrong file extension for language", async () => {
      const response = await request(app)
        .post("/judge")
        .field("language", "python")
        .field("problemID", "1")
        .attach("code", path.join(__dirname, "code/cpp/test1/main.cpp")); // .cpp for python

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(
        "Invalid file extension for python. Expected: .py"
      );
    });

    test("should accept correct file extension for language", async () => {
      const response = await request(app)
        .post("/judge")
        .field("language", "cpp")
        .field("problemID", "1")
        .attach("code", path.join(__dirname, "code/cpp/test1/main.cpp"));

      // Should not return 400 for file extension validation
      expect(response.status).not.toBe(400);
    });

    test("should reject empty file", async () => {
      // Create an empty file
      const emptyFilePath = path.join(__dirname, "empty_file.py");
      fs.writeFileSync(emptyFilePath, "");

      try {
        const response = await request(app)
          .post("/judge")
          .field("language", "python")
          .field("problemID", "1")
          .attach("code", emptyFilePath);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Code file is empty");
      } finally {
        // Clean up
        if (fs.existsSync(emptyFilePath)) {
          fs.unlinkSync(emptyFilePath);
        }
      }
    });

    test("should reject file with only whitespace", async () => {
      // Create a file with only whitespace
      const whitespaceFilePath = path.join(__dirname, "whitespace_file.py");
      fs.writeFileSync(whitespaceFilePath, "   \n\t  \n  ");

      try {
        const response = await request(app)
          .post("/judge")
          .field("language", "python")
          .field("problemID", "1")
          .attach("code", whitespaceFilePath);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Code file contains no content");
      } finally {
        // Clean up
        if (fs.existsSync(whitespaceFilePath)) {
          fs.unlinkSync(whitespaceFilePath);
        }
      }
    });
  });

  describe("validateCodeFile Function", () => {
    test("should validate correct Python file", () => {
      const mockFile = {
        originalname: "test.py",
        size: 100,
        path: path.join(__dirname, "code/python/test1/main.py"),
      };

      const result = validateCodeFile(mockFile, "python");
      expect(result.success).toBe(true);
    });

    test("should validate correct C++ file", () => {
      const mockFile = {
        originalname: "test.cpp",
        size: 200,
        path: path.join(__dirname, "code/cpp/test1/main.cpp"),
      };

      const result = validateCodeFile(mockFile, "cpp");
      expect(result.success).toBe(true);
    });

    test("should reject file with wrong extension", () => {
      const mockFile = {
        originalname: "test.js",
        size: 100,
        path: path.join(__dirname, "code/python/test1/main.py"),
      };

      const result = validateCodeFile(mockFile, "python");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid file extension");
    });

    test("should reject file larger than 1MB", () => {
      const mockFile = {
        originalname: "test.py",
        size: 1024 * 1024 + 1, // 1MB + 1 byte
        path: path.join(__dirname, "code/python/test1/main.py"),
      };

      const result = validateCodeFile(mockFile, "python");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Code file too large (max 1MB)");
    });

    test("should reject null file", () => {
      const result = validateCodeFile(null, "python");
      expect(result.success).toBe(false);
      expect(result.error).toBe("No code file uploaded");
    });
  });

  describe("Parameter Validation", () => {
    test("should reject invalid submission ID format", async () => {
      const response = await request(app).get("/submission/"); // Empty ID

      expect(response.status).toBe(404);
    });

    test("should accept valid submission ID format", async () => {
      const response = await request(app).get("/submission/12345");

      // Should not return 400 for parameter validation
      expect(response.status).not.toBe(400);
    });
  });
});
