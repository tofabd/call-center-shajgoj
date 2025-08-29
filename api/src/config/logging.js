import pino from 'pino';

/**
 * Logging configuration for different environments
 */
export const createLogger = (environment = 'development') => {
  const baseConfig = {
    level: process.env.LOG_LEVEL || 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => {
        return { level: label };
      },
    },
    // Add request ID for correlation
    mixin() {
      return {
        requestId: this.requestId,
        environment: process.env.NODE_ENV || 'development'
      };
    }
  };

  switch (environment) {
    case 'development':
      return pino({
        ...baseConfig,
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname,requestId,environment',
            messageFormat: '{msg} {req.method} {req.url} {res.statusCode}'
          }
        }
      });

    case 'production':
      return pino({
        ...baseConfig,
        level: 'info', // Only log info and above in production
        // Production logs go to stdout/stderr for container orchestration
        // You can add file transport here if needed
      });

    case 'test':
      return pino({
        ...baseConfig,
        level: 'error', // Only log errors during tests
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: false,
            translateTime: false,
            ignore: 'pid,hostname,requestId,environment'
          }
        }
      });

    default:
      return pino(baseConfig);
  }
};

/**
 * HTTP logging configuration for pino-http
 */
export const createHttpLogger = (logger) => {
  return {
    logger,
    // Customize what gets logged
    customLogLevel: (req, res, err) => {
      if (res.statusCode >= 400 && res.statusCode < 500) return 'warn';
      if (res.statusCode >= 500) return 'error';
      if (res.statusCode >= 300 && res.statusCode < 400) return 'silent';
      return 'info';
    },
    // Customize request serialization
    customSuccessMessage: (req, res) => {
      return `${req.method} ${req.url} - ${res.statusCode}`;
    },
    // Customize error message
    customErrorMessage: (req, res, err) => {
      return `${req.method} ${req.url} - ${res.statusCode} - ${err.message}`;
    },
    // Add custom properties to logs
    customProps: (req, res) => {
      return {
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress,
        userId: req.user?.id || 'anonymous',
        requestId: req.id
      };
    },
    // Customize response serialization
    customResponseObject: (req, res) => {
      return {
        statusCode: res.statusCode,
        responseTime: res.getHeader('X-Response-Time'),
        contentLength: res.getHeader('Content-Length')
      };
    }
  };
};

/**
 * Environment-specific logging setup
 */
export const setupLogging = () => {
  const env = process.env.NODE_ENV || 'development';
  const logger = createLogger(env);
  
  // Add global error handlers
  process.on('uncaughtException', (err) => {
    logger.fatal('Uncaught Exception', { error: err.message, stack: err.stack });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', { reason, promise });
  });

  return logger;
};
