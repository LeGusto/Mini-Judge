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

// GET endpoint to get all available problem IDs
app.get("/problems", (req, res) => {
  const problemsDir = path.join(__dirname, "../problems");
  let problemIds = [];
  try {
    problemIds = fs.readdirSync(problemsDir).filter((file) => {
      const fullPath = path.join(problemsDir, file);
      return fs.statSync(fullPath).isDirectory();
    });
    res.json({ problems: problemIds });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to list problems", details: err.message });
  }
});

// GET endpoint to get problem metadata
app.get("/problem/:id/metadata", (req, res) => {
  const problemId = req.params.id;
  const metadataPath = path.join(
    __dirname,
    "../problems",
    problemId,
    "metadata.json"
  );

  if (!fs.existsSync(metadataPath)) {
    return res.status(404).json({ error: "Problem metadata not found" });
  }

  try {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
    res.json(metadata);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to read problem metadata", details: err.message });
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

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    queue: queueManager.getQueueStats(),
  });
});

// Start the server only when this file is run directly
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  const server = app.listen(PORT, () => {
    cleanTmpDir();
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`Max workers: ${process.env.MAX_WORKERS || 3}`);
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
