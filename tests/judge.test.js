const { executeCode } = require("../src/judge");
const fs = require("fs");
const path = require("path");

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

    const filePrefixPath = path.join(languageFolderPath, "file_prefix.txt");
    if (!fs.existsSync(filePrefixPath)) {
      throw new Error(
        `Missing file_prefix.txt in folder: ${languageFolderPath}`
      );
    }

    subfolders.forEach((subfolder) => {
      it(`should execute code in folder: ${subfolder}`, async () => {
        const subfolderPath = path.join(languageFolderPath, subfolder);

        const mainFilePath = path.join(
          subfolderPath,
          "main" + fs.readFileSync(filePrefixPath, "utf-8").trim()
        );
        const outputFilePath = path.join(subfolderPath, "output.txt");

        if (!fs.existsSync(mainFilePath) || !fs.existsSync(outputFilePath)) {
          throw new Error(
            `Missing main file or output.txt in folder: ${subfolderPath}`
          );
        }

        // Read the code and expected output
        const code = fs.readFileSync(mainFilePath, "utf-8");
        const expectedOutput = fs.readFileSync(outputFilePath, "utf-8").trim();

        const language = languageFolder; // Use the language folder name as the language
        const input = "";
        const problemId = null;

        const result = await executeCode({ code, language, input, problemId });
        if (result.error) {
          console.log(`Error: "${result.error}"`);
        }
        console.log(`Raw Output: "${result.output}"`);

        // Clean the output to remove non-ASCII characters and trim whitespace
        const cleanOutput = result.output.replace(/[^\x20-\x7E]+/g, "").trim();

        // Compare the actual output with the expected output
        expect(cleanOutput).toBe(expectedOutput);
      }, 20000);
    });
  });
});
