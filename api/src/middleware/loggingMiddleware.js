import pinoHttp from 'pino-http';
import { createComponentLogger } from '../config/logging.js';

/**
 * Pino HTTP logging middleware for structured request/response logging
 */
export const createLoggingMiddleware = () => {
  const logger = createComponentLogger('HTTP');
  
  return pinoHttp({
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
        userId: req.user?.id || 'anonymous'
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
  });
};

/**
 * Simple logging middleware for backward compatibility
 */
export const simpleLoggingMiddleware = (req, res, next) => {
  const logger = createComponentLogger('HTTP');
  const start = Date.now();
  
  // Log request start
  logger.info(`${req.method} ${req.path}`, {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent')
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const responseTime = Date.now() - start;
    
    logger.info(`${req.method} ${req.path} - ${res.statusCode}`, {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTime,
      contentLength: res.getHeader('Content-Length')
    });
    
    // Call original end method
    originalEnd.call(this, chunk, encoding);
  };

  next();
};

export default createLoggingMiddleware;
