const { type } = require("os");
const config = require("../config");
const { executeCode } = require("../src/judge");
const fs = require("fs");
const path = require("path");

// Append copies of files to tmp folder
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

  // Return the path for manual cleanup instead of using setTimeout
  return destinationPath;
}

describe("executeCode", () => {
  const testFolder = path.join(__dirname, "code");
  const languageSubfolders = fs
    .readdirSync(testFolder)
    .filter((folder) =>
      fs.statSync(path.join(testFolder, folder)).isDirectory()
    );

  // Track created files for cleanup
  const createdFiles = [];

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
      
        const prefix = Date.now() + "_" + path.basename(subfolder) + "_";
      
        const inputFilePath = path.join(subfolderPath, "input.txt");
        const codeFilePath = path.join(subfolderPath, "main" + fileExtension);
      
        const inputFilename = fs.existsSync(inputFilePath)
          ? prefix + path.basename(inputFilePath)
          : null;
        const codeFilename = prefix + "main" + fileExtension;
      
        const codeFilePathTmp = appendFileToTmp(codeFilePath, codeFilename);
        createdFiles.push(codeFilePathTmp);
        
        let inputFilePathTmp = null;
        if (inputFilename) {
          inputFilePathTmp = appendFileToTmp(inputFilePath, inputFilename);
          createdFiles.push(inputFilePathTmp);
        }
      
        const inputFiles = inputFilename
          ? [{ filename: inputFilename, absolutePath: path.join(__dirname, "../tmp", inputFilename) }]
          : [];
      
        const language = languageFolder;
        const constraints = {
          timeLimit: 2,     // seconds
          memoryLimit: 128, // MB
          tests: 1
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

  // Cleanup created files after all tests
  afterAll(() => {
    createdFiles.forEach(filePath => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.warn(`Failed to cleanup file ${filePath}:`, err.message);
      }
    });
  });
});
