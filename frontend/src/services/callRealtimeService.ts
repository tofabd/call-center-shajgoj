import echo from './echo';

export interface CallUpdate {
  id: number;
  callerNumber: string;
  callerName: string | null;
  startTime: string | null;
  endTime: string | null;
  status: string;
  duration: number | null;
  direction: string;
  agentExten: string | null;
  otherParty: string;
  timestamp: string;
}

class CallRealtimeService {
  private listeners: Map<string, (update: CallUpdate) => void> = new Map();
  private isListening = false;

  /**
   * Start listening to real-time call updates
   */
  startListening(): void {
    if (this.isListening) {
      return;
    }

    // Check if Echo is available
    if (!echo) {
      console.error('❌ Echo not available - cannot start real-time call listening');
      return;
    }

    try {
      echo.channel('call-console')
        .listen('.call-updated', (update: CallUpdate) => {
          console.log('📞 Real-time call update:', update);
          this.notifyListeners(update);
        });

      this.isListening = true;
      console.log('✅ Started listening to real-time call updates');
    } catch (error) {
      console.error('❌ Failed to start real-time call listening:', error);
      this.isListening = false;
    }
  }

  /**
   * Stop listening to real-time updates
   */
  stopListening(): void {
    if (!this.isListening) {
      return;
    }

    // Check if Echo is available
    if (!echo) {
      console.warn('⚠️ Echo not available - cannot stop real-time call listening');
      this.isListening = false;
      return;
    }

    try {
      echo.leaveChannel('call-console');
      this.isListening = false;
      console.log('🛑 Stopped listening to real-time call updates');
    } catch (error) {
      console.error('❌ Failed to stop real-time call listening:', error);
      this.isListening = false;
    }
  }

  /**
   * Subscribe to call updates
   */
  subscribe(callId: string, callback: (update: CallUpdate) => void): () => void {
    this.listeners.set(callId, callback);
    
    // Start listening if this is the first subscriber
    if (this.listeners.size === 1) {
      this.startListening();
    }

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callId);
      
      // Stop listening if no more subscribers
      if (this.listeners.size === 0) {
        this.stopListening();
      }
    };
  }

  /**
   * Subscribe to all call updates
   */
  subscribeToAll(callback: (update: CallUpdate) => void): () => void {
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
  private notifyListeners(update: CallUpdate): void {
    this.listeners.forEach((callback) => {
      try {
        callback(update);
      } catch (error) {
        console.error('Error in call update callback:', error);
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

export const callRealtimeService = new CallRealtimeService();
export default callRealtimeService;