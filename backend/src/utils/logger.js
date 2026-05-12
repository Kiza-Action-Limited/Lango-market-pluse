// utils/logger.js
// Simple logging utility

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'info'];

const logger = {
  error: (message, ...args) => {
    if (currentLevel >= LOG_LEVELS.error) {
      console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, ...args);
    }
  },
  warn: (message, ...args) => {
    if (currentLevel >= LOG_LEVELS.warn) {
      console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, ...args);
    }
  },
  info: (message, ...args) => {
    if (currentLevel >= LOG_LEVELS.info) {
      console.info(`[INFO] ${new Date().toISOString()} - ${message}`, ...args);
    }
  },
  debug: (message, ...args) => {
    if (currentLevel >= LOG_LEVELS.debug) {
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, ...args);
    }
  },
};

module.exports = logger;