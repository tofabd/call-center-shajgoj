import net from 'net';
import dotenv from 'dotenv';

dotenv.config();

/**
 * AmiConnectionManager - Simple, reliable connection layer (PHP-style)
 * Handles basic socket connections and authentication
 */
class AmiConnectionManager {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.connectionTimeout = 10000; // 10 seconds like PHP
    this.keepAliveInterval = null;
    this.connectionState = 'disconnected';
  }

  /**
   * Establish a simple, direct connection (PHP-style)
   */
  async establishConnection(host, port, username, password) {
    return new Promise((resolve, reject) => {
      console.log(`🔌 [ConnectionManager] Connecting to ${host}:${port}...`);
      
      // Simple timeout like PHP
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout - server not responding'));
      }, this.connectionTimeout);

      try {
        // Direct connection like PHP
        this.socket = net.createConnection(port, host);
        
        this.socket.on('connect', () => {
          clearTimeout(timeout);
          console.log('🔗 [ConnectionManager] Socket connected successfully');
          this.connectionState = 'connected';
          resolve();
        });

        this.socket.on('error', (error) => {
          clearTimeout(timeout);
          console.error('❌ [ConnectionManager] Socket error:', error.message);
          this.connectionState = 'failed';
          reject(error);
        });

        this.socket.on('close', () => {
          console.log('🔌 [ConnectionManager] Socket closed');
          this.connectionState = 'disconnected';
          this.connected = false;
          this.stopKeepAlive();
        });

        this.socket.on('end', () => {
          console.log('🔌 [ConnectionManager] Socket ended');
          this.connectionState = 'disconnected';
          this.connected = false;
        });

      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * Simple authentication (PHP-style)
   */
  async authenticate(username, password, eventsMode = 'on') {
    return new Promise((resolve, reject) => {
      console.log(`🔐 [ConnectionManager] Authenticating with username: ${username}`);
      
      const loginCmd = `Action: Login\r\nUsername: ${username}\r\nSecret: ${password}\r\nEvents: ${eventsMode}\r\n\r\n`;
      
      this.socket.write(loginCmd);
      
      // Handle multi-part response like real AMI
      let responseBuffer = '';
      let responseTimeout;
      
      const dataHandler = (data) => {
        responseBuffer += data.toString();
        console.log(`📥 [ConnectionManager] Authentication data received: ${data.toString().trim()}`);
        
        // Check if we have a complete response
        if (responseBuffer.includes('Response: Success') || responseBuffer.includes('Response: Error')) {
          clearTimeout(responseTimeout);
          this.socket.removeListener('data', dataHandler);
          
          if (responseBuffer.includes('Response: Success')) {
            console.log('✅ [ConnectionManager] Authentication successful');
            this.connected = true;
            this.startKeepAlive();
            resolve();
          } else {
            console.error('❌ [ConnectionManager] Authentication failed');
            reject(new Error('Authentication failed - invalid credentials'));
          }
        }
      };
      
      this.socket.on('data', dataHandler);
      
      // Timeout after 10 seconds
      responseTimeout = setTimeout(() => {
        this.socket.removeListener('data', dataHandler);
        console.error('❌ [ConnectionManager] Authentication timeout');
        reject(new Error('Authentication timeout - no response received'));
      }, 10000);
    });
  }

  /**
   * Start keep-alive to maintain connection
   */
  startKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }
    
    // Send keep-alive every 30 seconds
    this.keepAliveInterval = setInterval(() => {
      if (this.socket && this.connected) {
        try {
          this.socket.write('Action: Ping\r\n\r\n');
        } catch (error) {
          console.warn('⚠️ [ConnectionManager] Keep-alive failed:', error.message);
        }
      }
    }, 30000);
  }

  /**
   * Stop keep-alive
   */
  stopKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      connected: this.connected,
      state: this.connectionState,
      socket: this.socket ? 'active' : 'null'
    };
  }

  /**
   * Get connection status (alias for compatibility)
   */
  getStatus() {
    return this.getConnectionStatus();
  }

  /**
   * Check if connection is healthy
   */
  isHealthy() {
    return this.socket && this.connected && this.connectionState === 'connected';
  }

  /**
   * Disconnect the connection
   */
  async disconnect() {
    console.log('🔌 [ConnectionManager] Disconnecting...');
    await this.cleanup();
  }

  /**
   * Clean up connection
   */
  async cleanup() {
    console.log('🧹 [ConnectionManager] Cleaning up connection...');
    
    this.stopKeepAlive();
    this.connected = false;
    this.connectionState = 'disconnected';
    
    if (this.socket) {
      try {
        this.socket.end();
        this.socket.destroy();
      } catch (error) {
        console.warn('⚠️ [ConnectionManager] Error during cleanup:', error.message);
      }
      this.socket = null;
    }
  }

  /**
   * Get socket for event processing
   */
  getSocket() {
    return this.socket;
  }
}

export default AmiConnectionManager;
