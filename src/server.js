const express = require("express");
const queueManager = require("./queue_manager");
const multer = require('multer');
const path = require('path');
const fs = require('fs');


function cleanTmpDir() {
  const grandParentDir = path.dirname(__dirname);
  const tmpDir = path.join(grandParentDir, "/tmp");

  try {
    const files = fs.readdirSync(tmpDir);
    for (const file of files) {
      const filePath = path.join(tmpDir, file);
      fs.unlinkSync(filePath);
      console.log(`Deleted ${file}`);
    }
  } catch (err) {
    console.error("Failed to clean tmp folder on exit:", err.message);
  }
}

const app = express();
app.use(express.json());

// Multer storage logic
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'tmp/'); 
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const originalName = file.originalname;
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    
    cb(null, `${timestamp}_${baseName}${ext}`);
  }
});

// Multer instance with custom storage for files
const upload = multer({ storage: storage });
cleanTmpDir();

app.post("/judge", upload.fields([
  { name: 'code', maxCount: 1 }
]), async (req, res) => {
  const { language, problemID } = req.body;

  if (!req.files.code || !language || !problemID) {
    return res.status(400).json({ error: "ProblemID, code and language are required" });
  }

  const codeFilename = req.files.code[0].filename;

  // Validate problem exists
  const problemDir = path.join("problems", problemID);
  const inputDir = path.join(problemDir, "input");
  const outputDir = path.join(problemDir, "output");

  if (!fs.existsSync(inputDir) || !fs.existsSync(outputDir)) {
    return res.status(400).json({ error: "Problem input/output directory not found" });
  }

  try {
    // Add submission to queue
    const submissionId = await queueManager.addSubmission({
      language,
      problemID,
      codeFilename
    });

    res.json({ 
      submissionId,
      status: "queued",
      message: "Submission added to queue for processing"
    });

  } catch (err) {
    console.error("Queue error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get submission status
app.get("/submission/:id", (req, res) => {
  const submissionId = req.params.id;
  const submission = queueManager.getSubmissionStatus(submissionId);
  
  if (!submission) {
    return res.status(404).json({ error: "Submission not found" });
  }
  
  res.json(submission);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

const shutdown = () => {
  cleanTmpDir();
  process.exit();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', shutdown);

module.exports = app;

/*
curl -X POST http://localhost:3000/judge \
  -F "code=@tests/code/cpp/test1/main.cpp" \
  -F "language=cpp" \
  -F "expectedOutput=Hello, World!"


*/