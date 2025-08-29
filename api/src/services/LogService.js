/**
 * Comprehensive logging service similar to Laravel's Log facade
 */
class LogService {
  constructor() {
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
   * Format log message with context
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
   * Log error message
   */
  error(message, context = {}) {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, context));
    }
  }

  /**
   * Log warning message
   */
  warn(message, context = {}) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, context));
    }
  }

  /**
   * Log info message
   */
  info(message, context = {}) {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, context));
    }
  }

  /**
   * Log debug message
   */
  debug(message, context = {}) {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, context));
    }
  }

  /**
   * Log AMI event with full context
   */
  amiEvent(eventType, fields) {
    this.info(`AMI ${eventType} event`, {
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
   * Log call decision with context
   */
  callDecision(message, context) {
    this.info(`Call direction decision: ${message}`, context);
  }
}

// Export singleton instance
export default new LogService();