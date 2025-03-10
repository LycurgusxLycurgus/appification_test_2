import logger, { LOG_LEVELS } from './logger';

/**
 * Initializes the logger with appropriate settings based on environment
 */
export const initLogger = () => {
  // Set default log level based on environment
  if (process.env.NODE_ENV === 'production') {
    // In production, only show errors and warnings
    logger.setLogLevel(LOG_LEVELS.WARN);
  } else if (process.env.NODE_ENV === 'development') {
    // In development, show info and above
    logger.setLogLevel(LOG_LEVELS.INFO);
  } else {
    // In other environments (like test), show info and above
    logger.setLogLevel(LOG_LEVELS.INFO);
  }

  // Enable timestamps in development for better debugging
  if (process.env.NODE_ENV === 'development') {
    logger.enableTimestamps(true);
  }

  // Add ability to change log level via URL parameter
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const logLevel = urlParams.get('logLevel');
    if (logLevel) {
      const level = LOG_LEVELS[logLevel.toUpperCase()];
      if (level !== undefined) {
        logger.setLogLevel(level);
      }
    }
  } catch (e) {
    // Ignore errors when accessing URL parameters
  }

  // Add ability to change log level via console
  window.setLogLevel = (level) => {
    if (typeof level === 'string') {
      const levelValue = LOG_LEVELS[level.toUpperCase()];
      if (levelValue !== undefined) {
        logger.setLogLevel(levelValue);
        return `Log level set to ${level.toUpperCase()}`;
      } else {
        return `Invalid log level: ${level}. Valid levels are: ${Object.keys(LOG_LEVELS).join(', ')}`;
      }
    } else if (typeof level === 'number') {
      if (Object.values(LOG_LEVELS).includes(level)) {
        logger.setLogLevel(level);
        return `Log level set to ${logger.getLogLevelName(level)}`;
      } else {
        return `Invalid log level: ${level}. Valid levels are: ${Object.values(LOG_LEVELS).join(', ')}`;
      }
    }
    return `Current log level: ${logger.getLogLevelName(logger.LEVELS.currentLogLevel)}`;
  };

  // Log initialization
  logger.info('Logger', `Logger initialized with level: ${logger.getLogLevelName(logger.LEVELS.currentLogLevel)}`);
  logger.info('Logger', `Environment: ${process.env.NODE_ENV}`);
  logger.info('Logger', 'To change log level, use window.setLogLevel(level) in console');
  logger.info('Logger', 'Valid levels: NONE, ERROR, WARN, INFO, DEBUG, VERBOSE');
};

export default initLogger; 