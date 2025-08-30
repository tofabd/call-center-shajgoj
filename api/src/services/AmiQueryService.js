import net from 'net';
import dotenv from 'dotenv';
import Extension from '../models/Extension.js';
import broadcast from './BroadcastService.js';
import { createComponentLogger } from '../config/logging.js';

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
    
    // Initialize Pino logger for this component
    this.logger = createComponentLogger('AmiQueryService');
  }

  async start() {
    const host = process.env.AMI_HOST || '103.177.125.83';
    const port = parseInt(process.env.AMI_PORT) || 5038;
    const username = process.env.AMI_USERNAME || 'admin';
    const password = process.env.AMI_PASSWORD || 'Tractor@0152';

    this.logger.info(`🔌 Starting AMI Query Service - connecting to ${host}:${port}...`);

    try {
      await this.connect(host, port, username, password);
      this.reconnectAttempts = 0;
      this.startPeriodicChecks();
    } catch (error) {
      this.logger.error('❌ AMI Query Service connection failed:', { error: error.message });
      this.scheduleReconnect();
    }
  }

  connect(host, port, username, password) {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(port, host);

      this.socket.on('connect', () => {
        this.logger.info('🔗 AMI Query Service connected to Asterisk AMI');
        this.login(username, password)
          .then(() => {
            this.logger.info('✅ AMI Query Service authentication successful');
            this.connected = true;
            this.setupDataHandler();
            resolve();
          })
          .catch(reject);
      });

      this.socket.on('error', (error) => {
        this.logger.error('❌ AMI Query Service socket error:', { error: error.message });
        this.connected = false;
        if (!this.socket.connecting) {
          reject(error);
        }
      });

      this.socket.on('close', () => {
        this.logger.info('🔌 AMI Query Service connection closed');
        this.connected = false;
        this.clearPeriodicChecks();
        this.scheduleReconnect();
      });

      this.socket.on('end', () => {
        this.logger.info('🔌 AMI Query Service connection ended');
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

  async queryExtensionStateList() {
    try {
      this.logger.info('📋 Querying ExtensionStateList from AMI...');
      
      const command = `Action: ExtensionStateList\r\nContext: from-internal\r\n\r\n`;
      const response = await this.sendCommand(command, 15000); // Increased timeout for bulk query
      
      this.logger.info('✅ ExtensionStateList query completed successfully');
      return response;
    } catch (error) {
      this.logger.error('❌ ExtensionStateList query failed:', { error: error.message });
      throw error;
    }
  }

  parseExtensionStateListResponse(response) {
    const extensions = [];
    const lines = response.split('\r\n');
    
    let currentExtension = null;
    
    for (const line of lines) {
      if (line.startsWith('Extension: ')) {
        if (currentExtension) {
          extensions.push(currentExtension);
        }
        currentExtension = {
          extension: line.substring(11).trim(),
          status: null,
          context: null
        };
      } else if (line.startsWith('Status: ') && currentExtension) {
        currentExtension.status = parseInt(line.substring(8).trim());
      } else if (line.startsWith('Context: ') && currentExtension) {
        currentExtension.context = line.substring(9).trim();
      }
    }
    
    // Add the last extension
    if (currentExtension) {
      extensions.push(currentExtension);
    }
    
    return extensions;
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

  mapDeviceState(asteriskStatus) {
    const deviceStateMap = {
      '0': 'NOT_INUSE',
      '1': 'INUSE',
      '2': 'BUSY',
      '4': 'UNAVAILABLE',
      '8': 'RINGING',
      '16': 'RING*INUSE',
      '-1': 'UNKNOWN'
    };

    return deviceStateMap[asteriskStatus] || 'UNKNOWN';
  }

  async performStatusCheck() {
    if (this.isQuerying) {
      this.logger.info('⏳ Previous query still in progress, skipping...');
      return;
    }

    if (!this.connected) {
      this.logger.warn('⚠️ AMI not connected, skipping status check');
      return;
    }

    this.logger.info('🔍 Starting extension status check with ExtensionStateList...');
    this.isQuerying = true;
    this.lastQueryTime = new Date();

    try {
      // STEP 1: Get all active extensions from database
      this.logger.info('📋 STEP 1: Fetching active extensions from database...');
      const dbExtensions = await Extension.find({ is_active: true }).lean();
      this.logger.info(`📋 STEP 1 COMPLETE: Found ${dbExtensions.length} active extensions in database`);
      
      // Log all extensions from database
      this.logger.info('📋 Database Extensions List:', {
        extensions: dbExtensions.map(ext => ({
          extension: ext.extension,
          currentStatus: ext.status,
          currentStatusCode: ext.status_code,
          currentDeviceState: ext.device_state,
          agentName: ext.agent_name
        }))
      });

      // STEP 2: Query AMI for all extension statuses using ExtensionStateList
      this.logger.info('📊 STEP 2: Querying AMI using Action: ExtensionStateList...');
      const amiResponse = await this.queryExtensionStateList();
      const amiExtensions = this.parseExtensionStateListResponse(amiResponse);
      this.logger.info(`📊 STEP 2 COMPLETE: AMI returned ${amiExtensions.length} extension statuses`);

      // Log all extensions from AMI
      this.logger.info('📊 AMI Extensions List:', {
        extensions: amiExtensions.map(ext => ({
          extension: ext.extension,
          statusCode: ext.status,
          context: ext.context
        }))
      });

      // STEP 3: Create a map of AMI extension statuses for quick lookup
      this.logger.info('🔄 STEP 3: Creating AMI status map for comparison...');
      const amiStatusMap = new Map();
      amiExtensions.forEach(ext => {
        amiStatusMap.set(ext.extension, {
          status: this.mapExtensionStatus(ext.status.toString()),
          statusCode: ext.status,
          deviceState: this.mapDeviceState(ext.status.toString())
        });
      });
      this.logger.info(`🔄 STEP 3 COMPLETE: Created status map for ${amiStatusMap.size} extensions`);

      // STEP 4: Update database and track changes
      this.logger.info('📝 STEP 4: Comparing and updating database...');
      const updates = [];
      const unchanged = [];
      const notFound = [];

      for (const dbExtension of dbExtensions) {
        const amiStatus = amiStatusMap.get(dbExtension.extension);
        
        if (amiStatus) {
          // Check if status has changed
          const statusChanged = dbExtension.status !== amiStatus.status || 
                               dbExtension.status_code !== amiStatus.statusCode ||
                               dbExtension.device_state !== amiStatus.deviceState;

          if (statusChanged) {
            try {
              // Update extension status in database
              const updatedExtension = await Extension.updateStatus(
                dbExtension.extension, 
                amiStatus.statusCode, 
                amiStatus.deviceState
              );
              
              if (updatedExtension) {
                updates.push({
                  extension: dbExtension.extension,
                  oldStatus: dbExtension.status,
                  newStatus: amiStatus.status,
                  oldStatusCode: dbExtension.status_code,
                  newStatusCode: amiStatus.statusCode,
                  oldDeviceState: dbExtension.device_state,
                  newDeviceState: amiStatus.deviceState
                });
                
                this.logger.info(`📝 UPDATED: Extension ${dbExtension.extension}: ${dbExtension.status} → ${amiStatus.status} (${dbExtension.status_code} → ${amiStatus.statusCode})`);
                
                // Broadcast individual extension updates for real-time frontend
                broadcast.extensionStatusUpdated(updatedExtension);
              }
            } catch (dbError) {
              this.logger.error(`❌ Failed to update extension ${dbExtension.extension} in database:`, { error: dbError.message });
            }
          } else {
            unchanged.push(dbExtension.extension);
            this.logger.info(`✅ UNCHANGED: Extension ${dbExtension.extension} - Status: ${dbExtension.status} (${dbExtension.status_code})`);
          }
        } else {
          notFound.push(dbExtension.extension);
          this.logger.warn(`⚠️ NOT FOUND: Extension ${dbExtension.extension} not found in AMI response`);
        }
      }

      // STEP 5: Log comprehensive summary
      this.logger.info('📊 STEP 5: Extension Status Update Summary:', {
        totalExtensions: dbExtensions.length,
        updated: updates.length,
        unchanged: unchanged.length,
        notFound: notFound.length,
        updateDetails: updates.map(u => ({
          extension: u.extension,
          statusChange: `${u.oldStatus} → ${u.newStatus}`,
          statusCodeChange: `${u.oldStatusCode} → ${u.newStatusCode}`,
          deviceStateChange: `${u.oldDeviceState} → ${u.newDeviceState}`
        }))
      });

      // Log detailed lists
      if (unchanged.length > 0) {
        this.logger.info(`✅ UNCHANGED EXTENSIONS LIST: ${unchanged.join(', ')}`);
      }

      if (updates.length > 0) {
        this.logger.info(`📝 UPDATED EXTENSIONS LIST: ${updates.map(u => u.extension).join(', ')}`);
      }

      if (notFound.length > 0) {
        this.logger.warn(`⚠️ NOT FOUND EXTENSIONS LIST: ${notFound.join(', ')}`);
      }

      this.successfulQueries++;
      
      // Log summary every 10 queries
      if (this.successfulQueries % 10 === 0) {
        this.logger.info(`📈 Query Statistics: ${this.successfulQueries} successful cycles, ${this.failedQueries} failed cycles`);
      }

    } catch (error) {
      this.logger.error('❌ Error during status check:', { error: error.message, stack: error.stack });
      this.failedQueries++;
    } finally {
      this.isQuerying = false;
    }
  }

  startPeriodicChecks() {
    this.logger.info(`⏰ Starting periodic extension status checks every ${this.queryIntervalMs / 1000} seconds`);
    
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
      this.logger.info('⏹️ Periodic extension checks stopped');
    }
  }

  // Manual refresh method for API calls
  async manualRefresh() {
    this.logger.info('🔄 MANUAL REFRESH: Manual extension refresh triggered via API');
    this.logger.info('🔄 MANUAL REFRESH: Following same workflow as periodic updates');
    
    if (!this.connected) {
      this.logger.error('❌ MANUAL REFRESH FAILED: AMI Query Service not connected');
      throw new Error('AMI Query Service not connected');
    }
    
    this.logger.info('🔄 MANUAL REFRESH: Executing performStatusCheck() workflow...');
    await this.performStatusCheck();
    
    // Get updated count from database after AMI queries
    const extensionCount = await Extension.countDocuments({ is_active: true });
    
    this.logger.info('✅ MANUAL REFRESH COMPLETE:', {
      lastQueryTime: this.lastQueryTime,
      extensionsChecked: extensionCount,
      statistics: {
        successfulQueries: this.successfulQueries,
        failedQueries: this.failedQueries
      }
    });
    
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
      this.logger.error('❌ Max reconnection attempts reached. Stopping AMI Query Service.');
      return;
    }

    this.reconnectAttempts++;
    this.logger.info(`🔄 Scheduling AMI Query Service reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelay}ms`);
    
    setTimeout(() => {
      this.start();
    }, this.reconnectDelay);
  }

  // Get service status
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
    this.logger.info('🛑 Stopping AMI Query Service...');
    this.clearPeriodicChecks();
    this.connected = false;
    
    if (this.socket) {
      this.socket.end();
    }
    
    // Clear pending queries
    this.pendingQueries.clear();
    
    this.logger.info('🛑 AMI Query Service stopped');
  }
}

export default AmiQueryService;