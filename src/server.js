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
  const { language, problemID } = req.body;

  if (!req.files.code || !language || !problemID) {
    return res.status(400).json({ error: "ProblemID, code and language are required" });
  }

  const codeFilename = req.files.code[0].filename;

  const problemDir = path.join("problems", problemID);
  const inputDir = path.join(problemDir, "input");
  const outputDir = path.join(problemDir, "output");

  if (!fs.existsSync(inputDir) || !fs.existsSync(outputDir)) {
    return res.status(400).json({ error: "Problem input/output directory not found" });
  }

  try {
    const inputFiles = fs.readdirSync(inputDir).filter(f => f.endsWith(".in")).sort();

    // Build input file list
    const inputFileObjs = inputFiles.map(file => {
      const fullPath = path.join(inputDir, file);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Input file not found: ${fullPath}`);
      }
      return {
        filename: path.basename(file),        // Just '1.in'
        absolutePath: fullPath                // Full path to use for tar copy
      };
    });

    const dataJsonPath = path.join(problemDir, "data.json");

    if (!fs.existsSync(dataJsonPath)) {
      return res.status(400).json({ error: "Missing data.json in problem folder" });
    }

    const constraints = JSON.parse(fs.readFileSync(dataJsonPath, "utf8"));
    const timeLimit = parseFloat(constraints.time_limit);
    const memoryLimit = parseInt(constraints.memory_limit);
    const tests = parseInt(constraints.tests);

    const executionResults = await executeCode({
      codeFilename,
      language,
      inputFiles: inputFileObjs,
      constraints: {
        timeLimit,
        memoryLimit,
        tests,
      },
    });

    // Match each result with expected output and determine verdict
    const results = executionResults.map(result => {
      const outputPath = path.join(outputDir, result.input.replace(".in", ".out"));
      if (!fs.existsSync(outputPath)) {
        return {
          test: result.input,
          verdict: "Missing Output File",
        };
      }

      const expectedOutput = fs.readFileSync(outputPath, "utf8");
      const verdict = getVerdict(result, expectedOutput);

      return {
        test: result.input,
        verdict,
        time: result.timeUsed,
        memory: result.memoryUsed
      };
    });

    const summary = {
      total: results.length,
      passed: results.filter(r => r.verdict === "Accepted").length,
      failed: results.filter(r => r.verdict !== "Accepted").length
    };

    res.json({ summary, results });

  } catch (err) {
    console.error("Judging error:", err);
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

module.exports = app;

/*
curl -X POST http://localhost:3000/judge \
  -F "code=@tests/code/cpp/test1/main.cpp" \
  -F "language=cpp" \
  -F "expectedOutput=Hello, World!"


*/