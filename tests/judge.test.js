const { type } = require("os");
const { executeCode } = require("../src/judge");
const fs = require("fs");
const path = require("path");

// Ensure tmp directory exists and clean it before each test
beforeEach(() => {
  const tmpDir = path.join(__dirname, "../tmp");
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
});

// Clean up tmp directory after each test
afterAll(() => {
  const tmpDir = path.join(__dirname, "../tmp");
  if (fs.existsSync(tmpDir)) {
    const files = fs.readdirSync(tmpDir);
    for (const file of files) {
      const filePath = path.join(tmpDir, file);
      try {
        fs.unlinkSync(filePath);
        console.log(`Cleaned up: ${file}`);
      } catch (err) {
        console.error(`Failed to clean up ${file}:`, err.message);
      }
    }
  }
});

// Append copes of files to tmp folder
function appendFileToTmp(filePath, fileName) {
  const tmpFolderPath = path.join(__dirname, "../tmp");

  // Error handling
  if (!fs.existsSync(filePath)) {
    throw new Error(`File does not exist: ${filePath}`);
  }
  if (!fs.existsSync(tmpFolderPath)) {
    throw new Error(`Temporary folder does not exist`);
  }

  // Default to actual file name if not provided
  if (!fileName) fileName = path.basename(filePath);

  const destinationPath = path.join(tmpFolderPath, fileName);

  const fileContent = fs.readFileSync(filePath, "utf-8");
  fs.writeFileSync(destinationPath, fileContent);

  // Return the destination path for cleanup
  return destinationPath;
}

describe("executeCode", () => {
  const testFolder = path.join(__dirname, "code");
  const languageSubfolders = fs
    .readdirSync(testFolder)
    .filter((folder) =>
      fs.statSync(path.join(testFolder, folder)).isDirectory()
    );

  languageSubfolders.forEach((languageFolder) => {
    const languageFolderPath = path.join(testFolder, languageFolder);

    // Get all subfolders in the language folder
    const subfolders = fs
      .readdirSync(languageFolderPath)
      .filter((subfolder) =>
        fs.statSync(path.join(languageFolderPath, subfolder)).isDirectory()
      );

    const fileExtensionPath = path.join(
      languageFolderPath,
      "file_extension.txt"
    );
    if (!fs.existsSync(fileExtensionPath)) {
      throw new Error(
        `Missing file_extension.txt in folder: ${languageFolderPath}`
      );
    }

    const fileExtension = fs.readFileSync(fileExtensionPath, "utf-8").trim();

    subfolders.forEach((subfolder) => {
      it(`should execute code in folder: ${subfolder}`, async () => {
        const subfolderPath = path.join(languageFolderPath, subfolder);
        const outputFilePath = path.join(subfolderPath, "output.txt");

        const expectedOutput = fs.readFileSync(outputFilePath, "utf-8").trim();

        const inputFilePath = path.join(subfolderPath, "input.txt");
        const codeFilePath = path.join(subfolderPath, "main" + fileExtension);

        // Copy files to tmp directory as the server would do
        const tmpDir = path.join(__dirname, "../tmp");
        const timestamp = Date.now();
        const codeFilename = `${timestamp}_main${fileExtension}`;
        const tmpCodeFilePath = path.join(tmpDir, codeFilename);

        // Copy code file to tmp
        fs.copyFileSync(codeFilePath, tmpCodeFilePath);
        console.log(`Created tmp file: ${tmpCodeFilePath}`);

        // Copy input file to tmp if it exists
        let tmpInputFilePath = null;
        let inputFiles = [];
        if (fs.existsSync(inputFilePath)) {
          const inputFilename = `${timestamp}_input.txt`;
          tmpInputFilePath = path.join(tmpDir, inputFilename);
          fs.copyFileSync(inputFilePath, tmpInputFilePath);
          console.log(`Created tmp input file: ${tmpInputFilePath}`);
          inputFiles = [
            { filename: inputFilename, absolutePath: tmpInputFilePath },
          ];
        }

        // Verify file exists before calling executeCode
        if (!fs.existsSync(tmpCodeFilePath)) {
          throw new Error(
            `Code file was deleted before executeCode could access it: ${tmpCodeFilePath}`
          );
        }
        console.log(`File exists before executeCode: ${tmpCodeFilePath}`);

        const language = languageFolder;
        const constraints = {
          timeLimit: 2, // seconds
          memoryLimit: 128, // MB
          tests: 1,
        };

        let results;
        try {
          results = await executeCode({
            codeFilename,
            language,
            inputFiles,
            constraints,
          });
        } catch (err) {
          console.error(`Execution error in ${subfolder}:`, err.message);
          throw err; // Fail the test
        }

        const result = results[0];
        if (!result) {
          throw new Error(`No result returned for ${subfolder}`);
        }

        if (result.verdict !== "OK") {
          console.warn(`Verdict: ${result.verdict}`);
          console.warn(`Output: "${result.output}"`);
        }

        const cleanOutput = result.output.replace(/[^\x20-\x7E]+/g, "").trim();
        console.log(`Time used: ${result.timeUsed}s`);

        expect(cleanOutput).toBe(expectedOutput);
      }, 5000);
    });
  });
});
