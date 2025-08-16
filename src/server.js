const express = require("express");
const queueManager = require("./queue_manager");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { cleanTmpDir } = require("./fileUtils");
const { validateBody, validateParams } = require("./middleware");
const {
  judgeSubmissionSchema,
  submissionIdSchema,
  validateCodeFile,
} = require("./validation");

// Initialize the express app
const app = express();

// Use the express.json middleware to parse JSON bodies
app.use(express.json());

// Multer storage logic for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "tmp/");
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const originalName = file.originalname;
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);

    cb(null, `${timestamp}_${baseName}${ext}`);
  },
});

// Multer instance with custom storage for file uploads
const upload = multer({ storage: storage });

// POST endpoint to judge a submission
app.post(
  "/judge",
  upload.fields([{ name: "code", maxCount: 1 }]),
  validateBody(judgeSubmissionSchema),
  async (req, res) => {
    // Get the language and problem ID from the request body
    const { language, problemID } = req.body;

    if (!req.files.code) {
      return res.status(400).json({ error: "Code file is required" });
    }

    // Validate the uploaded code file
    const codeFile = req.files.code[0];
    const validation = validateCodeFile(codeFile, language);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error });
    }

    // Get the code filename
    const codeFilename = codeFile.filename;

    // Validate problem exists
    const problemDir = path.join("problems", problemID);
    const outputDir = path.join(problemDir, "output");

    // Check if the output directory exists
    if (!fs.existsSync(outputDir)) {
      return res
        .status(400)
        .json({ error: "Problem output directory not found" });
    }

    try {
      // Add submission to the queue
      const submissionId = await queueManager.addSubmission({
        language,
        problemID,
        codeFilename,
      });

      // Return the submission ID and status
      res.json({
        submissionId,
        status: "queued",
        message: "Submission added to queue for processing",
      });
    } catch (err) {
      // Return an error if the submission fails to be added to the queue
      console.error("Queue error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// GET endpoint to get the status of a submission
app.get("/submission/:id", validateParams(submissionIdSchema), (req, res) => {
  // Get the submission ID from the request params
  const submissionId = req.params.id;

  // Get the submission status
  const submission = queueManager.getSubmissionStatus(submissionId);

  // Check if the submission exists
  if (!submission) {
    return res.status(404).json({ error: "Submission not found" });
  }

  res.json(submission);
});

// GET endpoint to get problems with metadata from data.json
// Optional query: ids=1,2 or ids=1&ids=2
app.get("/problems", (req, res) => {
  const problemsDir = path.join(__dirname, "../problems");

  try {
    const problemIds = fs
      .readdirSync(problemsDir)
      .filter((file) =>
        fs.statSync(path.join(problemsDir, file)).isDirectory()
      );

    // Parse optional ids filter from query string
    const rawIds = req.query.ids;
    let selectedIds = null;
    if (rawIds) {
      const list = [];
      rawIds.forEach((value) => {
        if (typeof value === "string") {
          value
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
            .forEach((s) => list.push(s));
        }
      });
      if (list.length > 0) {
        selectedIds = new Set(list);
      }
    }

    const filteredIds = selectedIds
      ? problemIds.filter((id) => selectedIds.has(id))
      : problemIds;

    const problems = filteredIds.reduce((acc, problemId) => {
      const dataPath = path.join(problemsDir, problemId, "data.json");
      try {
        if (fs.existsSync(dataPath)) {
          const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
          acc.push({ id: problemId, ...data });
        } else {
          // If data.json is missing, still include the id
          acc.push({ id: problemId });
        }
      } catch (e) {
        // Skip malformed data.json but keep the id visible
        acc.push({ id: problemId });
      }
      return acc;
    }, []);

    res.json({ problems });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to list problems", details: err.message });
  }
});

// GET endpoint to serve problem statement PDF
app.get("/problem/:id/statement", (req, res) => {
  const problemId = req.params.id;
  const pdfPath = path.join(
    __dirname,
    "../problems",
    problemId,
    "statement.pdf"
  );

  if (!fs.existsSync(pdfPath)) {
    return res.status(404).json({ error: "Problem statement not found" });
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="problem_${problemId}_statement.pdf"`
  );
  fs.createReadStream(pdfPath).pipe(res);
});

// Start the server only when this file is run directly
if (require.main === module) {
  const PORT = 3000;
  const server = app.listen(PORT, () => {
    cleanTmpDir();
    console.log(`Server is running on http://localhost:${PORT}`);
  });

  // Shutdown the server
  const shutdown = () => {
    cleanTmpDir();
    process.exit();
  };

  // Shutdown the server on SIGINT, SIGTERM, and exit
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("exit", shutdown);
}

module.exports = app;

/*
curl -X POST http://localhost:3000/judge \
  -F "code=@tests/code/cpp/test1/main.cpp" \
  -F "language=cpp" \
  -F "expectedOutput=Hello, World!"


*/
