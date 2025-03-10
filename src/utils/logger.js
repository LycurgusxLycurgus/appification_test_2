/**
 * Logger utility for consistent logging with configurable verbosity levels
 */

// Log levels
export const LOG_LEVELS = {
  NONE: 0,      // No logging
  ERROR: 1,     // Only errors
  WARN: 2,      // Errors and warnings
  INFO: 3,      // Normal information (default)
  DEBUG: 4,     // Detailed debug information
  VERBOSE: 5    // Very detailed logs
};

// Current log level - can be changed at runtime
let currentLogLevel = LOG_LEVELS.INFO;

// Whether to include timestamps in logs
let includeTimestamp = false;

/**
 * Sets the current log level
 * @param {number} level - The log level to set
 */
export const setLogLevel = (level) => {
  if (Object.values(LOG_LEVELS).includes(level)) {
    currentLogLevel = level;
    info('Logger', `Log level set to ${getLogLevelName(level)}`);
  } else {
    warn('Logger', `Invalid log level: ${level}`);
  }
};

/**
 * Gets the name of a log level
 * @param {number} level - The log level
 * @returns {string} The name of the log level
 */
export const getLogLevelName = (level) => {
  return Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === level) || 'UNKNOWN';
};

/**
 * Enables or disables timestamps in logs
 * @param {boolean} enable - Whether to include timestamps
 */
export const enableTimestamps = (enable) => {
  includeTimestamp = enable;
  info('Logger', `Timestamps ${enable ? 'enabled' : 'disabled'}`);
};

/**
 * Formats a log message with optional timestamp and module name
 * @param {string} module - The module name
 * @param {string} message - The message to log
 * @returns {string} The formatted message
 */
const formatMessage = (module, message) => {
  const timestamp = includeTimestamp ? `[${new Date().toISOString()}] ` : '';
  const modulePrefix = module ? `[${module}] ` : '';
  return `${timestamp}${modulePrefix}${message}`;
};

/**
 * Logs an error message
 * @param {string} module - The module name
 * @param {string} message - The message to log
 * @param {Error} [error] - Optional error object
 */
export const error = (module, message, error) => {
  if (currentLogLevel >= LOG_LEVELS.ERROR) {
    console.error(formatMessage(module, `❌ ${message}`));
    if (error) {
      console.error(error);
    }
  }
};

/**
 * Logs a warning message
 * @param {string} module - The module name
 * @param {string} message - The message to log
 */
export const warn = (module, message) => {
  if (currentLogLevel >= LOG_LEVELS.WARN) {
    console.warn(formatMessage(module, `⚠️ ${message}`));
  }
};

/**
 * Logs an info message
 * @param {string} module - The module name
 * @param {string} message - The message to log
 */
export const info = (module, message) => {
  if (currentLogLevel >= LOG_LEVELS.INFO) {
    console.log(formatMessage(module, `ℹ️ ${message}`));
  }
};

/**
 * Logs a debug message
 * @param {string} module - The module name
 * @param {string} message - The message to log
 */
export const debug = (module, message) => {
  if (currentLogLevel >= LOG_LEVELS.DEBUG) {
    console.log(formatMessage(module, `🔍 ${message}`));
  }
};

/**
 * Logs a verbose message
 * @param {string} module - The module name
 * @param {string} message - The message to log
 */
export const verbose = (module, message) => {
  if (currentLogLevel >= LOG_LEVELS.VERBOSE) {
    console.log(formatMessage(module, `📝 ${message}`));
  }
};

/**
 * Logs a game state update
 * @param {string} module - The module name
 * @param {Object} state - The state object to log
 * @param {Array<string>} [properties] - Optional array of properties to log
 */
export const logState = (module, state, properties) => {
  if (currentLogLevel >= LOG_LEVELS.DEBUG) {
    if (properties && Array.isArray(properties)) {
      const stateSnapshot = {};
      properties.forEach(prop => {
        if (state[prop] !== undefined) {
          stateSnapshot[prop] = state[prop];
        }
      });
      debug(module, `State update: ${JSON.stringify(stateSnapshot)}`);
    } else {
      debug(module, `Full state: ${JSON.stringify(state)}`);
    }
  }
};

/**
 * Creates a group of logs with a title
 * @param {string} title - The group title
 * @param {Function} logFunction - Function that contains log calls
 */
export const group = (title, logFunction) => {
  if (currentLogLevel >= LOG_LEVELS.DEBUG) {
    console.group(title);
    logFunction();
    console.groupEnd();
  }
};

// Export a default logger object for convenience
export default {
  setLogLevel,
  getLogLevelName,
  enableTimestamps,
  error,
  warn,
  info,
  debug,
  verbose,
  logState,
  group,
  LEVELS: LOG_LEVELS
}; 