import { EventEmitter } from 'events';
import { createComponentLogger } from '../config/logging.js';

/**
 * Simple broadcast service to emit real-time events
 * Similar to Laravel's broadcast functionality
 */
class BroadcastService extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100); // Allow more listeners
    this.logger = createComponentLogger('BroadcastService');
  }

  /**
   * Broadcast a call update event
   */
  callUpdated(call) {
    this.emit('call.updated', call);
    this.logger.info('Call event broadcasted', { 
      linkedid: call.linkedid, 
      direction: call.direction 
    });
  }

  /**
   * Broadcast an extension status update event
   */
  extensionStatusUpdated(extension) {
    this.emit('extension.status.updated', {
      extension: extension.extension,
      agent_name: extension.agent_name,
      status: extension.status,
      status_code: extension.status_code,
      device_state: extension.device_state,
      last_status_change: extension.last_status_change,
      last_seen: extension.last_seen,
      department: extension.department,
      is_active: extension.is_active
    });
    
    this.logger.info('Extension status broadcasted', { 
      extension: extension.extension, 
      status: extension.status, 
      deviceState: extension.device_state 
    });
  }

  /**
   * Subscribe to call updates
   */
  onCallUpdated(callback) {
    this.on('call.updated', callback);
  }

  /**
   * Subscribe to extension status updates
   */
  onExtensionStatusUpdated(callback) {
    this.on('extension.status.updated', callback);
  }

  /**
   * Remove all listeners (cleanup)
   */
  cleanup() {
    this.removeAllListeners();
    this.logger.info('BroadcastService listeners cleaned up');
  }
}

// Export singleton instance
export default new BroadcastService();