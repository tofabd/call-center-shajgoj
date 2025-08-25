import { EventEmitter } from 'events';

/**
 * Simple broadcast service to emit real-time events
 * Similar to Laravel's broadcast functionality
 */
class BroadcastService extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100); // Allow more listeners
  }

  /**
   * Broadcast a call update event
   */
  callUpdated(call) {
    this.emit('call.updated', call);
    console.log(`📡 Call event broadcasted: ${call.linkedid} (${call.status || call.direction})`);
  }

  /**
   * Broadcast an extension status update event
   */
  extensionStatusUpdated(extension) {
    this.emit('extension.status.updated', extension);
    console.log(`📱 Extension status broadcasted: ${extension.extension} -> ${extension.status}`);
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
  }
}

// Export singleton instance
export default new BroadcastService();