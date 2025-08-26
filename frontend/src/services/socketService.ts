import { io, Socket } from 'socket.io-client';

export interface CallUpdateEvent {
  id: string;
  linkedid: string;
  status: string;
  direction?: 'incoming' | 'outgoing';
  other_party?: string;
  agent_exten?: string;
  started_at?: string;
  answered_at?: string;
  ended_at?: string;
  duration?: number;
  timestamp: string;
}

export interface ExtensionStatusEvent {
  extension: string;
  status: 'online' | 'offline' | 'unknown';
  agent_name?: string;
  last_seen?: string;
  timestamp: string;
}

class SocketService {
  private socket: Socket | null = null;
  private connected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 5000;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastHeartbeat: Date | null = null;
  private heartbeatTimeout = 30000; // 30 seconds
  private isPageVisible = true; // Add page visibility tracking

  constructor() {
    this.setupPageVisibilityListener(); // Add page visibility listener
    this.connect();
  }

  private setupPageVisibilityListener() {
    const handleVisibilityChange = () => {
      const wasVisible = this.isPageVisible;
      this.isPageVisible = !document.hidden;
      
      if (!wasVisible && this.isPageVisible) {
        console.log('📱 Page became visible, checking connection...');
        this.handlePageVisible();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also handle window focus/blur for better coverage
    const handleFocus = () => {
      if (!this.isPageVisible) {
        this.isPageVisible = true;
        this.handlePageVisible();
      }
    };
    
    const handleBlur = () => {
      this.isPageVisible = false;
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
  }

  private handlePageVisible() {
    // Force reconnection if disconnected
    if (!this.isConnected()) {
      console.log('🔄 Page visible but socket disconnected, reconnecting...');
      this.connect();
    } else {
      // Force a heartbeat to check connection health
      this.forceHeartbeat();
    }
  }

  private forceHeartbeat() {
    if (this.socket?.connected) {
      this.socket.emit('ping');
      this.lastHeartbeat = new Date();
    }
  }

  private connect() {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      
      console.log('🔌 Connecting to Socket.IO server:', API_BASE_URL);
      
      this.socket = io(API_BASE_URL, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true
      });

      this.socket.on('connect', () => {
        console.log('✅ Socket.IO connected:', this.socket?.id);
        this.connected = true;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
      });

      this.socket.on('connected', (data) => {
        console.log('📡 Server confirmation:', data.message, data.timestamp);
      });

      this.socket.on('disconnect', (reason) => {
        console.warn('❌ Socket.IO disconnected:', reason);
        this.connected = false;
        this.stopHeartbeat();
        this.handleReconnection();
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Socket.IO connection error:', error.message);
        this.connected = false;
        this.handleReconnection();
      });

    } catch (error) {
      console.error('❌ Failed to create Socket.IO connection:', error);
      this.handleReconnection();
    }
  }

  private handleReconnection() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectInterval / 1000}s`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectInterval);
    } else {
      console.error('❌ Max reconnection attempts reached. Socket.IO will not reconnect.');
    }
  }

  // Subscribe to call updates
  onCallUpdated(callback: (data: CallUpdateEvent) => void) {
    if (!this.socket) {
      console.warn('⚠️ Socket not initialized for call updates');
      return;
    }
    
    this.socket.on('call-updated', (data: CallUpdateEvent) => {
      console.log('📞 Received call update:', data);
      callback(data);
    });
  }

  // Subscribe to extension status updates
  onExtensionStatusUpdated(callback: (data: ExtensionStatusEvent) => void) {
    if (!this.socket) {
      console.warn('⚠️ Socket not initialized for extension updates');
      return;
    }
    
    this.socket.on('extension-status-updated', (data: ExtensionStatusEvent) => {
      console.log('📱 Received extension status update:', data);
      callback(data);
    });
  }

  // Remove all listeners
  removeAllListeners() {
    if (this.socket) {
      this.socket.removeAllListeners('call-updated');
      this.socket.removeAllListeners('extension-status-updated');
    }
  }

  // Get connection status
  isConnected() {
    return this.connected && this.socket?.connected;
  }

  // Heartbeat monitoring
  private startHeartbeat() {
    this.lastHeartbeat = new Date();
    this.heartbeatInterval = setInterval(() => {
      // Skip heartbeat when page is not visible to avoid throttling issues
      if (!this.isPageVisible) {
        return;
      }

      if (this.socket?.connected) {
        this.socket.emit('ping');
        
        // Check if we haven't received a heartbeat in too long
        if (this.lastHeartbeat && 
            new Date().getTime() - this.lastHeartbeat.getTime() > this.heartbeatTimeout) {
          console.warn('⚠️ Heartbeat timeout - forcing reconnection');
          this.socket.disconnect();
        }
      }
    }, 10000); // Ping every 10 seconds
    
    // Listen for server pong
    this.socket?.on('pong', () => {
      this.lastHeartbeat = new Date();
    });
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.lastHeartbeat = null;
  }

  // Get last heartbeat time
  getLastHeartbeat(): Date | null {
    return this.lastHeartbeat;
  }

  // Add method for manual reconnection
  public reconnect() {
    if (this.socket?.connected) {
      console.log('🔌 Socket already connected');
      return;
    }
    this.connect();
  }

  // Disconnect
  disconnect() {
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }
}

// Export singleton instance
export const socketService = new SocketService();
export default socketService;