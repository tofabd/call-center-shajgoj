import pino from 'pino';

/**
 * Enhanced logging service using Pino for high-performance structured logging
 * Maintains compatibility with existing LogService API while adding Pino benefits
 */
class LogService {
  constructor() {
    // Create Pino logger instance
    this.logger = pino({
      level: process.env.LOG_LEVEL || 'info',
      transport: process.env.NODE_ENV === 'development' ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      } : undefined,
      // Add custom serializers for better log formatting
      serializers: {
        req: pino.stdSerializers.req,
        res: pino.stdSerializers.res,
        err: pino.stdSerializers.err
      }
    });

    // Maintain backward compatibility
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    this.currentLevel = process.env.LOG_LEVEL || 'info';
  }

  /**
   * Get current timestamp in readable format
   */
  timestamp() {
    return new Date().toISOString();
  }

  /**
   * Format log message with context (maintained for backward compatibility)
   */
  formatMessage(level, message, context = {}) {
    const timestamp = this.timestamp();
    const contextStr = Object.keys(context).length > 0 ? JSON.stringify(context, null, 2) : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${contextStr ? '\n' + contextStr : ''}`;
  }

  /**
   * Check if should log at this level
   */
  shouldLog(level) {
    return this.levels[level] <= this.levels[this.currentLevel];
  }

  /**
   * Log error message using Pino
   */
  error(message, context = {}) {
    if (this.shouldLog('error')) {
      this.logger.error({ ...context, message });
    }
  }

  /**
   * Log warning message using Pino
   */
  warn(message, context = {}) {
    if (this.shouldLog('warn')) {
      this.logger.warn({ ...context, message });
    }
  }

  /**
   * Log info message using Pino
   */
  info(message, context = {}) {
    if (this.shouldLog('info')) {
      this.logger.info({ ...context, message });
    }
  }

  /**
   * Log debug message using Pino
   */
  debug(message, context = {}) {
    if (this.shouldLog('debug')) {
      this.logger.debug({ ...context, message });
    }
  }

  /**
   * Log AMI event with full context using Pino
   */
  amiEvent(eventType, fields) {
    this.info(`AMI ${eventType} event`, {
      eventType,
      linkedid: fields.Linkedid,
      uniqueid: fields.Uniqueid,
      channel: fields.Channel,
      exten: fields.Exten,
      context: fields.Context,
      callerIdNum: fields.CallerIDNum,
      dialString: fields.DialString,
      status: fields.Status || fields.ChannelStateDesc,
      all_fields: fields
    });
  }

  /**
   * Log call decision with context using Pino
   */
  callDecision(message, context) {
    this.info(`Call direction decision: ${message}`, context);
  }

  /**
   * Get the underlying Pino logger for advanced usage
   */
  getPinoLogger() {
    return this.logger;
  }

  /**
   * Log HTTP request (for middleware usage)
   */
  httpRequest(req, res, responseTime) {
    this.info('HTTP Request', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress
    });
  }

  /**
   * Log database operations
   */
  database(operation, collection, details = {}) {
    this.info(`Database ${operation}`, {
      operation,
      collection,
      ...details
    });
  }

  /**
   * Log socket events
   */
  socketEvent(event, socketId, data = {}) {
    this.info(`Socket ${event}`, {
      event,
      socketId,
      ...data
    });
  }
}

// Export singleton instance
export default new LogService();