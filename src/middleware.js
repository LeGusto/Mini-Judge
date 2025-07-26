const { ZodError } = require("zod");

/**
 * Middleware to validate request body using a Zod schema
 * @param {import('zod').ZodSchema} schema - The Zod schema to validate against
 * @returns {import('express').RequestHandler} Express middleware function
 */
function validateBody(schema) {
  return (req, res, next) => {
    try {
      const validatedData = schema.parse(req.body);
      req.body = validatedData; // Replace with validated data
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: "Validation failed",
          details: error.errors.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        });
      }
      next(error);
    }
  };
}

/**
 * Middleware to validate request parameters using a Zod schema
 * @param {import('zod').ZodSchema} schema - The Zod schema to validate against
 * @returns {import('express').RequestHandler} Express middleware function
 */
function validateParams(schema) {
  return (req, res, next) => {
    try {
      const validatedData = schema.parse(req.params);
      req.params = validatedData; // Replace with validated data
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: "Invalid parameters",
          details: error.errors.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        });
      }
      next(error);
    }
  };
}

module.exports = {
  validateBody,
  validateParams,
};
