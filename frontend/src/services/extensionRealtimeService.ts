import echo from './echo';
import type { Extension } from './extensionService';

export interface ExtensionStatusUpdate {
  id: number;
  extension: string;
  agent_name: string | null;
  availability_status: string;  // Updated to match backend broadcast
  status_code: number;          // Updated to match backend broadcast
  status_text?: string;         // Updated to match backend broadcast
  status_changed_at?: string;   // Updated to match backend broadcast
  updated_at: string;
  
  // Legacy fields for compatibility (will be mapped)
  status?: string;              // Mapped from availability_status
  device_state?: string;        // Mapped from status_code
  last_status_change?: string;  // Mapped from status_changed_at
  last_seen?: string | null;    // Legacy field
}

class ExtensionRealtimeService {
  private listeners: Map<string, (update: ExtensionStatusUpdate) => void> = new Map();
  private isListening = false;

  /**
   * Start listening to real-time extension status updates
   */
  startListening(): void {
    if (this.isListening) {
      return;
    }

    try {
      echo.channel('extensions')
        .listen('.extension.status.updated', (update: ExtensionStatusUpdate) => {
          console.log('📱 Real-time extension status update:', update);
          
          // Map backend broadcast data to frontend format for compatibility
          const mappedUpdate: ExtensionStatusUpdate = {
            ...update,
            status: update.availability_status || update.status || 'unknown',
            device_state: this.getDeviceStateFromStatusCode(update.status_code || 0),
            last_status_change: update.status_changed_at || update.last_status_change,
          };
          
          this.notifyListeners(mappedUpdate);
        });

      this.isListening = true;
      console.log('✅ Started listening to real-time extension updates');
    } catch (error) {
      console.error('❌ Failed to start real-time listening:', error);
    }
  }

  /**
   * Map status code to device state for compatibility
   */
  private getDeviceStateFromStatusCode(statusCode: number): string {
    switch (statusCode) {
      case 0: return 'NOT_INUSE';
      case 1: return 'INUSE';
      case 2: return 'BUSY';
      case 8: return 'RINGING';
      case 16: return 'RINGINUSE';
      case 4: return 'UNAVAILABLE';
      default: return 'UNKNOWN';
    }
  }

  /**
   * Stop listening to real-time updates
   */
  stopListening(): void {
    if (!this.isListening) {
      return;
    }

    try {
      echo.leaveChannel('extensions');
      this.isListening = false;
      console.log('🛑 Stopped listening to real-time extension updates');
    } catch (error) {
      console.error('❌ Failed to stop real-time listening:', error);
    }
  }

  /**
   * Subscribe to extension status updates
   */
  subscribe(extensionId: string, callback: (update: ExtensionStatusUpdate) => void): () => void {
    this.listeners.set(extensionId, callback);
    
    // Start listening if this is the first subscriber
    if (this.listeners.size === 1) {
      this.startListening();
    }

    // Return unsubscribe function
    return () => {
      this.listeners.delete(extensionId);
      
      // Stop listening if no more subscribers
      if (this.listeners.size === 0) {
        this.stopListening();
      }
    };
  }

  /**
   * Subscribe to all extension updates
   */
  subscribeToAll(callback: (update: ExtensionStatusUpdate) => void): () => void {
    const id = 'all';
    this.listeners.set(id, callback);
    
    // Start listening if this is the first subscriber
    if (this.listeners.size === 1) {
      this.startListening();
    }

    // Return unsubscribe function
    return () => {
      this.listeners.delete(id);
      
      // Stop listening if no more subscribers
      if (this.listeners.size === 0) {
        this.stopListening();
      }
    };
  }

  /**
   * Notify all listeners of an update
   */
  private notifyListeners(update: ExtensionStatusUpdate): void {
    this.listeners.forEach((callback) => {
      try {
        callback(update);
      } catch (error) {
        console.error('Error in extension status update callback:', error);
      }
    });
  }

  /**
   * Check if real-time is available
   */
  isAvailable(): boolean {
    return echo && typeof echo.channel === 'function';
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): 'connected' | 'disconnected' | 'unavailable' {
    if (!this.isAvailable()) {
      return 'unavailable';
    }

    // For Pusher, we can check connection state
    if (echo.connector && echo.connector.pusher) {
      const state = echo.connector.pusher.connection.state;
      return state === 'connected' ? 'connected' : 'disconnected';
    }

    // For Reverb, assume connected if we're listening
    return this.isListening ? 'connected' : 'disconnected';
  }
}

export const extensionRealtimeService = new ExtensionRealtimeService();
export default extensionRealtimeService;
