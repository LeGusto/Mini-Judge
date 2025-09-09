#!/usr/bin/env node
/**
 * Simple logging utility for Mini-Judge
 * Easy to use and understand
 */

const fs = require("fs");
const path = require("path");

// Create logs directory if it doesn't exist
const logDir = "logs";
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Simple log function
function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} | ${level.toUpperCase()} | ${message}`;

  // Console output
  console.log(logMessage);

  // File output
  const logFile = path.join(logDir, "app.log");
  fs.appendFileSync(logFile, logMessage + "\n");

  // Error file for errors
  if (level === "error") {
    const errorFile = path.join(logDir, "error.log");
    fs.appendFileSync(errorFile, logMessage + "\n");
  }
}

// Simple logging functions
function logInfo(message, data = {}) {
  log("info", message, data);
}

function logError(message, data = {}) {
  log("error", message, data);
}

function logWarning(message, data = {}) {
  log("warning", message, data);
}

function logDebug(message, data = {}) {
  log("debug", message, data);
}

function logRequest(method, path, statusCode, duration = null) {
  let message = `${method} ${path} -> ${statusCode}`;
  if (duration) {
    message += ` (${duration}ms)`;
  }
  logInfo(message);
}

function logSubmission(submissionId, action, details = "") {
  let message = `Submission ${submissionId} | ${action}`;
  if (details) {
    message += ` | ${details}`;
  }
  logInfo(message);
}

function logJudge(submissionId, result, details = "") {
  let message = `Judge ${submissionId} -> ${result}`;
  if (details) {
    message += ` | ${details}`;
  }
  logInfo(message);
}

function logQueue(event, details = "") {
  let message = `Queue ${event}`;
  if (details) {
    message += ` | ${details}`;
  }
  logInfo(message);
}

function logDocker(containerId, event, details = "") {
  let message = `Docker ${containerId} | ${event}`;
  if (details) {
    message += ` | ${details}`;
  }
  logInfo(message);
}

module.exports = {
  logInfo,
  logError,
  logWarning,
  logDebug,
  logRequest,
  logSubmission,
  logJudge,
  logQueue,
  logDocker,
};
