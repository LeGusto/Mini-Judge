const express = require("express");
const { executeCode } = require("./judge");
const { getVerdict } = require("./verdict");
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

  const { language, expectedOutput } = req.body;

  if (!req.files.code || !language || !problemID) {
    return res.status(400).json({ error: "ProblemID, code and language are required" });
  }

  try {
    codeFilename = req.files.code[0].filename

    // console.log(codeFilename, language)
    const result = await executeCode({codeFilename, language, problemID});
    const verdict = getVerdict(result, expectedOutput);

    res.json(verdict);
  } catch (error) {
     console.log(error)
    res.status(500).json({ error: "Internal server error" });
  }
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

/*
curl -X POST http://localhost:3000/judge \
  -F "code=@tests/code/cpp/test1/main.cpp" \
  -F "language=cpp" \
  -F "expectedOutput=Hello, World!"


*/