const { executeCode } = require("../src/judge");
const fs = require("fs");
const path = require("path");

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
  if (!fileName) filename = path.basename(filePath);

  const destinationPath = path.join(tmpFolderPath, fileName);

  const fileContent = fs.readFileSync(filePath, "utf-8");
  fs.writeFileSync(destinationPath, fileContent);

  // Set a TTL (Time-To-Live) of 60 seconds for the file
  setTimeout(() => {
    if (fs.existsSync(destinationPath)) {
      fs.unlinkSync(destinationPath);
    }
  }, 60000); // 60 seconds
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

        // Read the code and expected output
        // const code = fs
        //   .readFileSync(mainFilePath, "utf-8")
        //   .replace(/"/g, '\\"'); // Escape double quotes in the code
        const expectedOutput = fs.readFileSync(outputFilePath, "utf-8").trim();

        // Prefix for unique identification of test files in tmp
        const prefix = Date.now() + "_" + path.basename(subfolder) + "_";

        // Read the input file if it exists
        const inputFilePath = path.join(subfolderPath, "input.txt");
        const mainFilePath = path.join(subfolderPath, "main" + fileExtension);

        const inputFileName = fs.existsSync(inputFilePath)
          ? path.basename(inputFileName) + suffix
          : null;
        const mainFileName = prefix + "main" + fileExtension;

        appendFileToTmp(mainFilePath, mainFileName);
        if (inputFileName) {
          appendFileToTmp(inputFilePath, inputFileName);
        }

        console.log(inputFileName, mainFileName, "Testing");

        // const input = fs.existsSync(inputFilePath)
        //   ? fs.readFileSync(inputFilePath, "utf-8").trim()
        //   : null;

        const language = languageFolder; // Use the language folder name as the language
        const problemId = null;

        const result = await executeCode({
          mainFileName,
          language,
          inputFileName,
          problemId,
        });
        if (result.error) {
          console.log(`Error: "${result.error}"`);
        }

        // Clean the output to remove non-ASCII characters and trim whitespace
        const cleanOutput = result.output.replace(/[^\x20-\x7E]+/g, "").trim();

        // Compare the actual output with the expected output
        expect(cleanOutput).toBe(expectedOutput);
      }, 3000);
    });
  });
});
