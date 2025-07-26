const { z } = require("zod");
const fs = require("fs");
const path = require("path");

// Schema for the /judge endpoint
const judgeSubmissionSchema = z.object({
  language: z.enum(["python", "cpp"]),
  problemID: z.string().min(1),
});

// Schema for the /submission/:id endpoint
const submissionIdSchema = z.object({
  id: z.string().min(1),
});

// Schema for the /problems endpoint (no body validation needed)
const problemsSchema = z.object({});

/**
 * Validates the uploaded code file based on language
 * @param {Object} file - The uploaded file object from multer
 * @param {string} language - The programming language
 * @returns {Object} - Validation result with success boolean and error message
 */
function validateCodeFile(file, language) {
  if (!file) {
    return { success: false, error: "No code file uploaded" };
  }

  // Check file size (limit to 1MB)
  const maxSize = 1024 * 1024; // 1MB
  if (file.size > maxSize) {
    return { success: false, error: "Code file too large (max 1MB)" };
  }

  // Check file extension based on language
  const ext = path.extname(file.originalname).toLowerCase();
  const validExtensions = {
    python: [".py"],
    cpp: [".cpp", ".cc", ".cxx", ".c++"],
  };

  if (!validExtensions[language] || !validExtensions[language].includes(ext)) {
    return {
      success: false,
      error: `Invalid file extension for ${language}. Expected: ${validExtensions[
        language
      ].join(", ")}`,
    };
  }

  // Check if file is empty
  if (file.size === 0) {
    return { success: false, error: "Code file is empty" };
  }

  // Basic syntax validation (optional - could be expanded)
  try {
    const content = fs.readFileSync(file.path, "utf8");

    // Check for basic content
    if (!content.trim()) {
      return { success: false, error: "Code file contains no content" };
    }
  } catch (err) {
    return { success: false, error: "Unable to read code file" };
  }

  return { success: true };
}

module.exports = {
  judgeSubmissionSchema,
  submissionIdSchema,
  problemsSchema,
  validateCodeFile,
};
