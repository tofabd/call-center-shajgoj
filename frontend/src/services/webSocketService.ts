import React from 'react';
import { EventEmitter } from 'events';
import type { LiveCall } from './callService';

interface WebSocketCallEvent {
  type: 'call.updated' | 'call.created' | 'call.ended' | 'extension.status.updated';
  data: LiveCall | { extension: string; status: string };
  timestamp: string;
}

class WebSocketService extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectInterval: number = 5000; // 5 seconds
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private isConnecting: boolean = false;
  private url: string;

  constructor(url: string = 'ws://localhost:3000/ws') {
    super();
    this.url = url;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      if (this.isConnecting) {
        reject(new Error('Already connecting'));
        return;
      }

      this.isConnecting = true;

      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('🔗 WebSocket connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.emit('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketCallEvent = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('📡 Error parsing WebSocket message:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('🔌 WebSocket disconnected:', event.code, event.reason);
          this.isConnecting = false;
          this.emit('disconnected', event);
          
          // Attempt to reconnect if not a normal closure
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          this.isConnecting = false;
          this.emit('error', error);
          reject(error);
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection
  }

  /**
   * Send message to WebSocket server
   */
  send(message: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('⚠️ WebSocket not connected, cannot send message');
    }
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: WebSocketCallEvent): void {
    console.log('📡 WebSocket message received:', message.type, message.data);
    
    switch (message.type) {
      case 'call.updated':
      case 'call.created':
        this.emit('callUpdated', message.data as LiveCall);
        break;
      case 'call.ended':
        this.emit('callEnded', message.data as LiveCall);
        break;
      case 'extension.status.updated':
        this.emit('extensionStatusUpdated', message.data);
        break;
      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectInterval * this.reconnectAttempts, 30000); // Max 30 seconds
    
    console.log(`🔄 Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (this.reconnectAttempts <= this.maxReconnectAttempts) {
        this.connect().catch((error) => {
          console.error('Reconnection failed:', error);
        });
      }
    }, delay);
  }

  /**
   * Subscribe to call updates
   */
  onCallUpdated(callback: (call: LiveCall) => void): void {
    this.on('callUpdated', callback);
  }

  /**
   * Subscribe to call ended events
   */
  onCallEnded(callback: (call: LiveCall) => void): void {
    this.on('callEnded', callback);
  }

  /**
   * Subscribe to extension status updates
   */
  onExtensionStatusUpdated(callback: (data: { extension: string; status: string }) => void): void {
    this.on('extensionStatusUpdated', callback);
  }

  /**
   * Subscribe to connection status
   */
  onConnectionChange(callback: (connected: boolean) => void): void {
    this.on('connected', () => callback(true));
    this.on('disconnected', () => callback(false));
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService();

// Export hook for React components
export const useWebSocketConnection = () => {
  const [connected, setConnected] = React.useState(false);
  
  React.useEffect(() => {
    const handleConnection = (isConnected: boolean) => {
      setConnected(isConnected);
    };
    
    webSocketService.onConnectionChange(handleConnection);
    
    // Initial connection status
    setConnected(webSocketService.isConnected());
    
    return () => {
      webSocketService.removeAllListeners();
    };
  }, []);
  
  return {
    connected,
    connect: () => webSocketService.connect(),
    disconnect: () => webSocketService.disconnect(),
    send: (message: object) => webSocketService.send(message)
  };
};

export default webSocketService;