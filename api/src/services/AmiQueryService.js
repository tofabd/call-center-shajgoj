import net from 'net';
import dotenv from 'dotenv';
import Extension from '../models/Extension.js';
import broadcast from './BroadcastService.js';
import Log from './LogService.js';

dotenv.config();

class AmiQueryService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.reconnectDelay = 5000; // 5 seconds
    this.maxReconnectAttempts = 10;
    this.reconnectAttempts = 0;
    this.queryInterval = null;
    this.queryIntervalMs = 30000; // 30 seconds
    this.isQuerying = false;
    this.actionId = 1;
    this.pendingQueries = new Map();
    this.extensionList = [];
    this.lastQueryTime = null;
    this.successfulQueries = 0;
    this.failedQueries = 0;
  }

  async start() {
    const host = process.env.AMI_HOST || '103.177.125.83';
    const port = parseInt(process.env.AMI_PORT) || 5038;
    const username = process.env.AMI_USERNAME || 'admin';
    const password = process.env.AMI_PASSWORD || 'Tractor@0152';

    console.log(`🔌 Starting AMI Query Service - connecting to ${host}:${port}...`);

    try {
      await this.connect(host, port, username, password);
      this.reconnectAttempts = 0;
      this.startPeriodicChecks();
    } catch (error) {
      console.error('❌ AMI Query Service connection failed:', error.message);
      this.scheduleReconnect();
    }
  }

  connect(host, port, username, password) {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(port, host);

      this.socket.on('connect', () => {
        console.log('🔗 AMI Query Service connected to Asterisk AMI');
        this.login(username, password)
          .then(() => {
            console.log('✅ AMI Query Service authentication successful');
            this.connected = true;
            this.setupDataHandler();
            resolve();
          })
          .catch(reject);
      });

      this.socket.on('error', (error) => {
        console.error('❌ AMI Query Service socket error:', error.message);
        this.connected = false;
        if (!this.socket.connecting) {
          reject(error);
        }
      });

      this.socket.on('close', () => {
        console.log('🔌 AMI Query Service connection closed');
        this.connected = false;
        this.clearPeriodicChecks();
        this.scheduleReconnect();
      });

      this.socket.on('end', () => {
        console.log('🔌 AMI Query Service connection ended');
        this.connected = false;
        this.clearPeriodicChecks();
      });
    });
  }

  login(username, password) {
    return new Promise((resolve, reject) => {
      const loginCmd = `Action: Login\r\nUsername: ${username}\r\nSecret: ${password}\r\nEvents: off\r\n\r\n`;
      
      this.socket.write(loginCmd);
      
      this.socket.once('data', (data) => {
        const response = data.toString();
        if (response.includes('Response: Success')) {
          resolve();
        } else {
          reject(new Error('Authentication failed'));
        }
      });
    });
  }

  setupDataHandler() {
    let buffer = '';

    this.socket.on('data', (data) => {
      buffer += data.toString();
      
      // Process complete messages (messages are separated by double CRLF)
      const messages = buffer.split('\r\n\r\n');
      buffer = messages.pop(); // Keep incomplete message in buffer

      messages.forEach(messageData => {
        if (messageData.trim()) {
          this.processMessage(messageData);
        }
      });
    });
  }

  processMessage(messageData) {
    const lines = messageData.split('\r\n');
    const fields = {};

    lines.forEach(line => {
      const colonIndex = line.indexOf(': ');
      if (colonIndex !== -1) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 2).trim();
        fields[key] = value;
      }
    });

    const actionId = fields.ActionID;
    if (actionId && this.pendingQueries.has(actionId)) {
      const queryInfo = this.pendingQueries.get(actionId);
      this.pendingQueries.delete(actionId);
      
      if (fields.Response === 'Success') {
        queryInfo.resolve(fields);
      } else {
        queryInfo.reject(new Error(`AMI Query failed: ${fields.Message || 'Unknown error'}`));
      }
    }
  }

  sendCommand(command, timeout = 10000) {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.socket) {
        reject(new Error('AMI not connected'));
        return;
      }

      const actionId = this.actionId++;
      const commandWithId = command.replace('\r\n\r\n', `\r\nActionID: ${actionId}\r\n\r\n`);
      
      this.pendingQueries.set(actionId.toString(), { resolve, reject });
      
      // Set timeout
      const timeoutHandle = setTimeout(() => {
        if (this.pendingQueries.has(actionId.toString())) {
          this.pendingQueries.delete(actionId.toString());
          reject(new Error('Query timeout'));
        }
      }, timeout);

      this.socket.write(commandWithId, (err) => {
        if (err) {
          clearTimeout(timeoutHandle);
          this.pendingQueries.delete(actionId.toString());
          reject(err);
        }
      });
    });
  }

  async loadExtensionList() {
    // This method is no longer needed as we fetch directly from database each time
    // Kept for compatibility but made empty
    return;
  }

  async queryExtensionStatus(extension) {
    try {
      const command = `Action: ExtensionState\r\nExten: ${extension}\r\nContext: from-internal\r\n\r\n`;
      const response = await this.sendCommand(command, 5000);
      
      let status = 'unknown';
      const extStatus = response.Status;
      
      if (extStatus !== undefined) {
        status = this.mapExtensionStatus(extStatus);
      }

      return { extension, status, queryTime: new Date() };
    } catch (error) {
      console.warn(`⚠️ Failed to query extension ${extension}:`, error.message);
      return { extension, status: 'unknown', queryTime: new Date(), error: error.message };
    }
  }

  mapExtensionStatus(asteriskStatus) {
    const statusMap = {
      '0': 'online',    // NotInUse (Available)
      '1': 'online',    // InUse (Busy but online)
      '2': 'online',    // Busy (Still registered)
      '4': 'offline',   // Unavailable/Unregistered
      '8': 'online',    // Ringing
      '16': 'online',   // Ringinuse
      '-1': 'unknown'   // Unknown
    };

    return statusMap[asteriskStatus] || 'unknown';
  }

  async performStatusCheck() {
    if (this.isQuerying) {
      console.log('⏳ Previous query still in progress, skipping...');
      return;
    }

    if (!this.connected) {
      console.log('⚠️ AMI not connected, skipping status check');
      return;
    }

    console.log('🔍 Starting periodic extension status check...');
    this.isQuerying = true;
    this.lastQueryTime = new Date();

    try {
      // 1. Get all active extensions from database
      console.log('📋 Fetching extensions from database...');
      const extensions = await Extension.find({ is_active: true }).lean();
      console.log(`📋 Found ${extensions.length} active extensions in database`);
      
      // 2. Query AMI for each extension status
      const queryPromises = extensions.map(ext => 
        this.queryExtensionStatus(ext.extension)
      );

      const results = await Promise.allSettled(queryPromises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      console.log(`📊 AMI Query completed: ${successful} successful, ${failed} failed`);

      // 3. Update database with new status for each extension
      const updates = [];
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { extension, status } = result.value;
          
          try {
            // Update extension status in database
            const updatedExtension = await Extension.updateStatus(extension, status);
            updates.push(updatedExtension);
            console.log(`📝 Updated extension ${extension}: ${status}`);
            
            // Broadcast individual extension updates for real-time frontend
            broadcast.extensionStatusUpdated(updatedExtension);
          } catch (dbError) {
            console.error(`❌ Failed to update extension ${extension} in database:`, dbError.message);
          }
        }
      }

      this.successfulQueries++;
      
      console.log(`✅ Database update completed: ${updates.length} extensions updated in database`);
      
      // Log summary every 10 queries
      if (this.successfulQueries % 10 === 0) {
        console.log(`📈 Query Statistics: ${this.successfulQueries} successful cycles, ${this.failedQueries} failed cycles`);
      }

    } catch (error) {
      console.error('❌ Error during status check:', error.message);
      this.failedQueries++;
    } finally {
      this.isQuerying = false;
    }
  }

  startPeriodicChecks() {
    console.log(`⏰ Starting periodic extension status checks every ${this.queryIntervalMs / 1000} seconds`);
    
    // Clear any existing interval
    this.clearPeriodicChecks();
    
    // Perform initial check immediately
    setTimeout(() => this.performStatusCheck(), 2000);
    
    // Set up periodic checks
    this.queryInterval = setInterval(() => {
      this.performStatusCheck();
    }, this.queryIntervalMs);
  }

  clearPeriodicChecks() {
    if (this.queryInterval) {
      clearInterval(this.queryInterval);
      this.queryInterval = null;
      console.log('⏹️ Periodic extension checks stopped');
    }
  }

  // Manual refresh method for API calls - now database-driven
  async manualRefresh() {
    console.log('🔄 Manual extension refresh triggered - fetching from database and updating via AMI');
    if (!this.connected) {
      throw new Error('AMI Query Service not connected');
    }
    
    await this.performStatusCheck();
    
    // Get updated count from database after AMI queries
    const extensionCount = await Extension.countDocuments({ is_active: true });
    
    return {
      success: true,
      message: 'Extension status refresh completed - database updated',
      lastQueryTime: this.lastQueryTime,
      extensionsChecked: extensionCount,
      statistics: {
        successfulQueries: this.successfulQueries,
        failedQueries: this.failedQueries
      }
    };
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached. Stopping AMI Query Service.');
      return;
    }

    this.reconnectAttempts++;
    console.log(`🔄 Scheduling AMI Query Service reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelay}ms`);
    
    setTimeout(() => {
      this.start();
    }, this.reconnectDelay);
  }

  // Get service status - now database-driven
  async getStatus() {
    const extensionCount = await Extension.countDocuments({ is_active: true });
    
    return {
      connected: this.connected,
      queryInterval: this.queryIntervalMs,
      lastQueryTime: this.lastQueryTime,
      extensionsMonitored: extensionCount,
      statistics: {
        successfulQueries: this.successfulQueries,
        failedQueries: this.failedQueries
      },
      isQuerying: this.isQuerying
    };
  }

  stop() {
    console.log('🛑 Stopping AMI Query Service...');
    this.clearPeriodicChecks();
    this.connected = false;
    
    if (this.socket) {
      this.socket.end();
    }
    
    // Clear pending queries
    this.pendingQueries.clear();
    
    console.log('🛑 AMI Query Service stopped');
  }
}

export default AmiQueryService;