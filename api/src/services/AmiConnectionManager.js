import net from 'net';
import dotenv from 'dotenv';

dotenv.config();

/**
 * AmiConnectionManager - Network connection layer for AMI (Asterisk Manager Interface)
 * 
 * This class manages the low-level TCP socket connection to the Asterisk server,
 * handling connection establishment, authentication, and connection maintenance.
 * 
 * Responsibilities:
 * - TCP socket creation and management
 * - Connection timeout handling
 * - AMI authentication protocol implementation
 * - Keep-alive mechanism for connection persistence
 * - Connection state tracking and cleanup
 */
class AmiConnectionManager {
  constructor() {
    // Socket instance for AMI connection
    this.socket = null;
    
    // Connection status flag
    this.connected = false;
    
    // Connection timeout configuration (10 seconds)
    this.connectionTimeout = 10000;
    
    // Keep-alive interval reference
    this.keepAliveInterval = null;
    
    // Detailed connection state tracking
    this.connectionState = 'disconnected';
  }

  /**
   * Establishes a TCP connection to the Asterisk server
   * 
   * Creates a socket connection with timeout protection and
   * sets up event handlers for connection lifecycle events.
   * The connection process is asynchronous and returns a promise
   * that resolves when connected or rejects on failure.
   * 
   * @param {string} host - The Asterisk server hostname or IP address
   * @param {number} port - The AMI port number (typically 5038)
   * @param {string} username - AMI username for authentication
   * @param {string} password - AMI password for authentication
   * @returns {Promise} Resolves when connection is established
   * @throws {Error} When connection fails or times out
   */
  async establishConnection(host, port, username, password) {
    return new Promise((resolve, reject) => {
      console.log(`🔌 [ConnectionManager] Connecting to ${host}:${port}...`);
      
      // Set connection timeout to prevent indefinite waiting
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout - server not responding'));
      }, this.connectionTimeout);

      try {
        // Create TCP socket connection
        this.socket = net.createConnection(port, host);
        
        // Handle successful connection
        this.socket.on('connect', () => {
          clearTimeout(timeout);
          console.log('🔗 [ConnectionManager] Socket connected successfully');
          this.connectionState = 'connected';
          resolve();
        });

        // Handle connection errors
        this.socket.on('error', (error) => {
          clearTimeout(timeout);
          console.error('❌ [ConnectionManager] Socket error:', error.message);
          this.connectionState = 'failed';
          reject(error);
        });

        // Handle connection closure
        this.socket.on('close', () => {
          console.log('🔌 [ConnectionManager] Socket closed');
          this.connectionState = 'disconnected';
          this.connected = false;
          this.stopKeepAlive();
        });

        // Handle connection termination
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
   * Authenticates with the Asterisk AMI using provided credentials
   * 
   * Sends the AMI login command and waits for a response indicating
   * success or failure. The authentication process includes:
   * - Sending login credentials in AMI protocol format
   * - Parsing multi-part response data
   * - Setting connection status based on authentication result
   * - Starting keep-alive mechanism on successful authentication
   * 
   * @param {string} username - AMI username
   * @param {string} password - AMI password
   * @param {string} eventsMode - Events mode ('on' for enabled, 'off' for disabled)
   * @returns {Promise} Resolves on successful authentication
   * @throws {Error} When authentication fails or times out
   */
  async authenticate(username, password, eventsMode = 'on') {
    return new Promise((resolve, reject) => {
      console.log(`🔐 [ConnectionManager] Authenticating with username: ${username}`);
      
      // Construct AMI login command in proper protocol format
      const loginCmd = `Action: Login\r\nUsername: ${username}\r\nSecret: ${password}\r\nEvents: ${eventsMode}\r\n\r\n`;
      
      // Send authentication command to server
      this.socket.write(loginCmd);
      
      // Buffer for accumulating response data
      let responseBuffer = '';
      let responseTimeout;
      
      // Handle incoming authentication response data
      const dataHandler = (data) => {
        responseBuffer += data.toString();
        console.log(`📥 [ConnectionManager] Authentication data received: ${data.toString().trim()}`);
        
        // Check for complete authentication response
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
      
      // Register data handler for authentication response
      this.socket.on('data', dataHandler);
      
      // Set authentication timeout (10 seconds)
      responseTimeout = setTimeout(() => {
        this.socket.removeListener('data', dataHandler);
        console.error('❌ [ConnectionManager] Authentication timeout');
        reject(new Error('Authentication timeout - no response received'));
      }, 10000);
    });
  }

  /**
   * Initiates keep-alive mechanism to maintain connection
   * 
   * Sends periodic ping commands to prevent the connection from
   * being closed due to inactivity. The keep-alive interval is
   * set to 30 seconds to balance between connection maintenance
   * and network overhead.
   */
  startKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }
    
    // Send keep-alive ping every 30 seconds
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
   * Stops the keep-alive mechanism
   * 
   * Clears the keep-alive interval to prevent further ping
   * commands from being sent. Called during connection cleanup
   * or when the connection is no longer active.
   */
  stopKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  /**
   * Retrieves current connection status information
   * 
   * Provides detailed information about the connection state,
   * including connection status, state machine status, and
   * socket availability for monitoring and debugging.
   * 
   * @returns {Object} Connection status object with detailed information
   */
  getConnectionStatus() {
    return {
      connected: this.connected,
      state: this.connectionState,
      socket: this.socket ? 'active' : 'null'
    };
  }

  /**
   * Retrieves connection status (alias for compatibility)
   * 
   * Provides the same information as getConnectionStatus()
   * for backward compatibility with existing code.
   * 
   * @returns {Object} Connection status object
   */
  getStatus() {
    return this.getConnectionStatus();
  }

  /**
   * Evaluates the overall health of the connection
   * 
   * A connection is considered healthy when:
   * - Socket exists and is active
   * - Connection status is 'connected'
   * - Connection state is 'connected'
   * 
   * @returns {boolean} True if connection is healthy, false otherwise
   */
  getHealthStatus() {
    return this.socket && this.connected && this.connectionState === 'connected';
  }

  /**
   * Gracefully disconnects from the Asterisk server
   * 
   * Initiates the connection cleanup process, ensuring
   * proper resource deallocation and state reset.
   */
  async disconnect() {
    console.log('🔌 [ConnectionManager] Disconnecting...');
    await this.cleanup();
  }

  /**
   * Performs comprehensive connection cleanup
   * 
   * Cleans up all connection-related resources including:
   * - Stopping keep-alive mechanism
   * - Resetting connection state flags
   * - Properly closing and destroying socket
   * - Nullifying socket reference
   */
  async cleanup() {
    console.log('🧹 [ConnectionManager] Cleaning up connection...');
    
    // Stop keep-alive mechanism
    this.stopKeepAlive();
    
    // Reset connection state
    this.connected = false;
    this.connectionState = 'disconnected';
    
    // Clean up socket if it exists
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
   * Provides access to the underlying socket instance
   * 
   * Returns the socket reference for use by other components
   * such as event processors that need direct socket access
   * for reading and writing data.
   * 
   * @returns {net.Socket|null} The socket instance or null if not connected
   */
  getSocket() {
    return this.socket;
  }
}

export default AmiConnectionManager;
