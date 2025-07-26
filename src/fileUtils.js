const fs = require("fs");
const path = require("path");
const tar = require("tar");
const os = require("os");

/**
 * Copies files to a temporary directory and creates a tar stream of them.
 * @param {string[]} filePaths - Array of file paths to include in the tar.
 * @returns {tar.Pack} - Tar stream containing the files.
 */
function createTarStream(filePaths) {
  const tmpFolder = fs.mkdtempSync(path.join(os.tmpdir(), "judge-"));
  const tempPaths = [];

  for (const originalPath of filePaths) {
    const baseName = path.basename(originalPath);
    const tempTarget = path.join(tmpFolder, baseName);
    fs.copyFileSync(originalPath, tempTarget);
    tempPaths.push(tempTarget);
  }

  return tar.create(
    { cwd: tmpFolder },
    tempPaths.map((p) => path.basename(p))
  );
}

/**
 * Cleans all files in the tmp directory (relative to project root).
 */
function cleanTmpDir() {
  const grandParentDir = path.dirname(__dirname);
  const tmpDir = path.join(grandParentDir, "/tmp");

  try {
    if (!fs.existsSync(tmpDir)) {
      return; // Directory doesn't exist, nothing to clean
    }

    const files = fs.readdirSync(tmpDir);
    for (const file of files) {
      const filePath = path.join(tmpDir, file);
      try {
        fs.unlinkSync(filePath);
        console.log(`Deleted ${file}`);
      } catch (fileErr) {
        // Ignore individual file errors
        console.log(`Could not delete ${file}: ${fileErr.message}`);
      }
    }
  } catch (err) {
    console.error("Failed to clean tmp folder on exit:", err.message);
  }
}

module.exports = { createTarStream, cleanTmpDir };
