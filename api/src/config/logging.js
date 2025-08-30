import pino from 'pino';

// Create Pino logger instance
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
      messageFormat: '{msg}',
      errorLikeObjectKeys: ['err', 'error'],
      errorProps: 'message,stack,code,errno'
    }
  },
  base: {
    env: process.env.NODE_ENV || 'development',
    revision: process.env.GIT_REVISION || 'unknown'
  }
});

// Create child loggers for different components
export const createComponentLogger = (component) => {
  return logger.child({ component });
};

// Export main logger
export default logger;
