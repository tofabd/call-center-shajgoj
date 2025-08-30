import net from 'net';
import dotenv from 'dotenv';
import Call from '../models/Call.js';
import CallLeg from '../models/CallLeg.js';
import BridgeSegment from '../models/BridgeSegment.js';
import Extension from '../models/Extension.js';
import broadcast from './BroadcastService.js';
import Log from './LogService.js';

dotenv.config();

class AmiListener {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.reconnectDelay = 5000; // 5 seconds
    this.maxReconnectAttempts = 10;
    this.reconnectAttempts = 0;
    this.eventHandlers = new Map();
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.eventHandlers.set('Newchannel', this.handleNewchannel.bind(this));
    this.eventHandlers.set('Newstate', this.handleNewstate.bind(this));
    this.eventHandlers.set('Hangup', this.handleHangup.bind(this));
    this.eventHandlers.set('DialBegin', this.handleDialBegin.bind(this));
    this.eventHandlers.set('DialEnd', this.handleDialEnd.bind(this));
    this.eventHandlers.set('BridgeEnter', this.handleBridgeEnter.bind(this));
    this.eventHandlers.set('BridgeLeave', this.handleBridgeLeave.bind(this));
    this.eventHandlers.set('ExtensionStatus', this.handleExtensionStatus.bind(this));
  }

  async start() {
    const host = process.env.AMI_HOST;
    const port = parseInt(process.env.AMI_PORT);
    const username = process.env.AMI_USERNAME;
    const password = process.env.AMI_PASSWORD;

    // Validate required environment variables
    if (!host || !port || !username || !password) {
      throw new Error('Missing required AMI environment variables. Please ensure AMI_HOST, AMI_PORT, AMI_USERNAME, and AMI_PASSWORD are set in your .env file.');
    }

    console.log(`🔌 Connecting to Asterisk AMI at ${host}:${port}...`);

    try {
      await this.connect(host, port, username, password);
      this.reconnectAttempts = 0;
    } catch (error) {
      console.error('❌ AMI Connection failed:', error.message);
      this.scheduleReconnect();
    }
  }

  connect(host, port, username, password) {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(port, host);

      this.socket.on('connect', () => {
        console.log('🔗 Connected to Asterisk AMI');
        this.login(username, password)
          .then(() => {
            console.log('✅ AMI Authentication successful');
            this.connected = true;
            this.setupEventListeners();
            resolve();
          })
          .catch(reject);
      });

      this.socket.on('error', (error) => {
        console.error('❌ AMI Socket error:', error.message);
        this.connected = false;
        if (!this.socket.connecting) {
          reject(error);
        }
      });

      this.socket.on('close', () => {
        console.log('🔌 AMI Connection closed');
        this.connected = false;
        this.scheduleReconnect();
      });

      this.socket.on('end', () => {
        console.log('🔌 AMI Connection ended');
        this.connected = false;
      });
    });
  }

  login(username, password) {
    return new Promise((resolve, reject) => {
      const loginCmd = `Action: Login\r\nUsername: ${username}\r\nSecret: ${password}\r\nEvents: on\r\n\r\n`;
      
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

  setupEventListeners() {
    let buffer = '';

    this.socket.on('data', (data) => {
      buffer += data.toString();
      
      // Process complete events (events are separated by double CRLF)
      const events = buffer.split('\r\n\r\n');
      buffer = events.pop(); // Keep incomplete event in buffer

      events.forEach(eventData => {
        if (eventData.trim()) {
          this.processEvent(eventData);
        }
      });
    });
  }

  processEvent(eventData) {
    const lines = eventData.split('\r\n');
    const fields = {};

    lines.forEach(line => {
      const colonIndex = line.indexOf(': ');
      if (colonIndex !== -1) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 2).trim();
        fields[key] = value;
      }
    });

    const eventName = fields.Event;
    if (!eventName) return;

    // Log the event with comprehensive details
    Log.amiEvent(eventName, fields);

    // Only process specific events we handle
    const handledEvents = [
      'Newchannel', 'Newstate', 'Hangup', 'DialBegin', 'DialEnd',
      'BridgeEnter', 'BridgeLeave', 'ExtensionStatus'
    ];

    if (!handledEvents.includes(eventName)) {
      // Log ignored events at debug level
      Log.debug(`Ignoring AMI event: ${eventName}`);
      return;
    }

    // Handle the event if we have a handler
    if (this.eventHandlers.has(eventName)) {
      try {
        this.eventHandlers.get(eventName)(fields);
      } catch (error) {
        console.error(`❌ Error handling ${eventName} event:`, error.message);
      }
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached. Stopping AMI listener.');
      return;
    }

    this.reconnectAttempts++;
    console.log(`🔄 Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelay}ms`);
    
    setTimeout(() => {
      this.start();
    }, this.reconnectDelay);
  }

  // Utility methods (similar to Laravel version)
  normalizeNumber(value) {
    if (typeof value !== 'string') return null;
    const raw = value.trim();
    if (raw === '' || raw.toLowerCase().includes('unknown')) return null;
    
    if (raw.startsWith('+')) {
      const digits = raw.substring(1).replace(/\D+/g, '');
      return digits ? '+' + digits : null;
    }
    
    const digits = raw.replace(/\D+/g, '');
    return digits || null;
  }

  isLikelyExtension(value) {
    const norm = this.normalizeNumber(value);
    if (!norm) return false;
    return /^\d{3,5}$/.test(norm.replace(/^\+/, ''));
  }

  isLikelyExternalNumber(value) {
    const norm = this.normalizeNumber(value);
    if (!norm) return false;
    return norm.replace(/^\+/, '').length >= 6;
  }

  extractIncomingNumber(fields) {
    const candidates = [
      fields.CallerIDNum,
      fields.ConnectedLineNum
    ];
    
    for (const candidate of candidates) {
      if (this.isLikelyExternalNumber(candidate)) {
        return this.normalizeNumber(candidate);
      }
    }
    return null;
  }

  extractOutgoingNumber(fields) {
    const candidates = [
      this.extractNumberFromDialString(fields.DialString),
      fields.DestCallerIDNum,
      fields.ConnectedLineNum,
      fields.Exten,
      fields.CallerIDNum
    ];

    for (const candidate of candidates) {
      if (this.isLikelyExternalNumber(candidate)) {
        const normalized = this.normalizeNumber(candidate);
        if (normalized) return normalized;
      }
    }
    return null;
  }

  extractNumberFromDialString(dialString) {
    if (!dialString) return null;

    // Handle patterns like "BDCOM75/01831317738" -> "01831317738"
    if (/^[A-Z0-9]+\/([0-9+]+)$/.test(dialString)) {
      return dialString.split('/')[1];
    }

    // Handle complex patterns - take the last numeric part
    const match = dialString.match(/\/([0-9+]{6,})(?:\/|$)/);
    if (match) return match[1];

    // If it's all digits or starts with +, use as-is
    if (/^[+]?[0-9]{6,}$/.test(dialString)) {
      return dialString;
    }

    return null;
  }

  async ensureCall(fields, hints = {}) {
    const linkedid = fields.Linkedid;
    if (!linkedid) return null;

    try {
      let call = await Call.findOne({ linkedid });
      let isNew = false;

      if (!call) {
        call = new Call({ linkedid });
        call.started_at = new Date();
        isNew = true;
      }

      // Set direction from context or hints
      let direction = hints.direction;
      const isMasterEvent = fields.Uniqueid === fields.Linkedid;
      
      if (isMasterEvent && !direction) {
        const ctx = fields.Context || '';
        if (ctx.includes('from-trunk')) {
          direction = 'incoming';
        } else if (ctx.includes('macro-dialout-trunk') || ctx.includes('from-internal')) {
          direction = 'outgoing';
        }
      }

      if (direction && !call.direction) {
        call.direction = direction;
        
        // Log call direction decision like PHP version
        Log.callDecision('Call direction decided', {
          linkedid: call.linkedid,
          direction: direction,
          context: fields.Context,
          channel: fields.Channel,
          exten: fields.Exten,
          callerid: fields.CallerIDNum,
          dialstring: fields.DialString,
          is_master: isMasterEvent
        });
      }

      // Set other party
      if (!call.other_party) {
        if (call.direction === 'incoming') {
          const num = this.extractIncomingNumber(fields);
          if (num) call.other_party = num;
        } else if (call.direction === 'outgoing') {
          const num = this.extractOutgoingNumber(fields);
          if (num) call.other_party = num;
        }
      }

      // Set agent extension
      if (!call.agent_exten) {
        const channel = fields.Channel || '';
        const match = channel.match(/(?:SIP|PJSIP|Local)\/(\d{3,5})/);
        if (match) call.agent_exten = match[1];
      }

      // Set caller info
      if (fields.CallerIDNum && !call.caller_number) {
        call.caller_number = this.normalizeNumber(fields.CallerIDNum);
      }
      if (fields.CallerIDName && !call.caller_name) {
        call.caller_name = fields.CallerIDName;
      }

      await call.save();
      return call;
    } catch (error) {
      console.error('❌ Error ensuring call:', error.message);
      return null;
    }
  }

  async upsertCallLeg(fields, extra = {}) {
    const uniqueid = fields.Uniqueid;
    const linkedid = fields.Linkedid;

    if (!uniqueid || !linkedid) {
      console.error('❌ Cannot create CallLeg: missing uniqueid or linkedid');
      return;
    }

    try {
      // Verify master call exists
      const callExists = await Call.findOne({ linkedid });
      if (!callExists) {
        console.error(`❌ Cannot create CallLeg: master Call with linkedid ${linkedid} does not exist`);
        return;
      }

      const updateData = {
        linkedid,
        channel: fields.Channel,
        exten: fields.Exten,
        context: fields.Context,
        channel_state: fields.ChannelState,
        channel_state_desc: fields.ChannelStateDesc,
        state: fields.State,
        callerid_num: fields.CallerIDNum,
        callerid_name: fields.CallerIDName,
        connected_line_num: fields.ConnectedLineNum,
        connected_line_name: fields.ConnectedLineName,
        ...extra
      };

      await CallLeg.findOneAndUpdate(
        { uniqueid },
        updateData,
        { upsert: true, new: true }
      );
    } catch (error) {
      console.error(`❌ Failed to save CallLeg for uniqueid ${uniqueid}:`, error.message);
    }
  }

  // Event handlers
  async handleNewchannel(fields) {
    if (!fields.Uniqueid || !fields.Linkedid) {
      console.error('❌ Missing required fields: Uniqueid or Linkedid');
      return;
    }

    try {
      await this.ensureCall(fields);
      await this.upsertCallLeg(fields, { start_time: new Date() });

      // Broadcast new call event for real-time updates (like Laravel)
      if (fields.Uniqueid === fields.Linkedid) {
        const masterCall = await Call.findOne({ linkedid: fields.Linkedid });
        if (masterCall) {
          broadcast.callUpdated(masterCall);
          console.log(`📡 New call broadcasted (linkedid: ${masterCall.linkedid})`);
        }
        
        console.log(`📞 New call tracked with Linkedid: ${fields.Linkedid}`);
        console.log(`   Caller: ${fields.CallerIDNum} (${fields.CallerIDName})`);
        console.log(`   Extension: ${fields.Exten}`);
      }
    } catch (error) {
      console.error('❌ Failed to handle Newchannel:', error.message);
    }
  }

  async handleNewstate(fields) {
    if (!fields.Uniqueid || !fields.Linkedid) return;

    try {
      const call = await this.ensureCall(fields);
      if (!call) return;

      await this.upsertCallLeg(fields);

      // Check if call was answered
      if (!call.answered_at) {
        const stateDesc = (fields.ChannelStateDesc || '').toLowerCase();
        if (stateDesc === 'up') {
          call.answered_at = new Date();
          if (call.started_at) {
            call.ring_seconds = Math.max(0, Math.floor((call.answered_at - call.started_at) / 1000));
          }
          await call.save();
          
          // Broadcast call answered event
          broadcast.callUpdated(call);
          console.log(`📞 Call answered: ${call.linkedid}`);
        }
      }
    } catch (error) {
      console.error('❌ Failed to handle Newstate:', error.message);
    }
  }

  async handleHangup(fields) {
    if (!fields.Uniqueid || !fields.Linkedid) return;

    try {
      const call = await this.ensureCall(fields);
      if (!call) return;

      // Update the specific leg that hung up
      await this.upsertCallLeg(fields, {
        hangup_at: new Date(),
        hangup_cause: fields.Cause
      });

      // Only set ended_at if this is the master call AND all active legs are gone
      if (fields.Uniqueid === fields.Linkedid) {
        const activeLegs = await CallLeg.countDocuments({
          linkedid: call.linkedid,
          hangup_at: null
        });

        if (activeLegs === 0) {
          call.ended_at = new Date();
          if (fields.Cause) {
            call.hangup_cause = fields.Cause;
          }
          if (call.answered_at && call.ended_at && !call.talk_seconds) {
            call.talk_seconds = Math.max(0, Math.floor((call.ended_at - call.answered_at) / 1000));
          }
          await call.save();
          
          // Broadcast call ended event
          broadcast.callUpdated(call);
          console.log(`📞 Call ended: ${call.linkedid} (Cause: ${fields.Cause || 'N/A'})`);
        }
      }
    } catch (error) {
      console.error('❌ Failed to handle Hangup:', error.message);
    }
  }

  async handleDialBegin(fields) {
    const dialedFromDialString = this.extractNumberFromDialString(fields.DialString);
    const ctx = fields.Context || '';
    const shouldHintOutgoing = this.isLikelyExternalNumber(dialedFromDialString) ||
                              ctx.includes('from-internal') ||
                              ctx.includes('macro-dialout-trunk');

    try {
      const call = await this.ensureCall(fields, shouldHintOutgoing ? { direction: 'outgoing' } : {});
      if (!call) return;

      const outgoingNumber = this.extractOutgoingNumber(fields);
      if (outgoingNumber) {
        call.other_party = outgoingNumber;
        await call.save();
        
        // Broadcast outgoing call update
        broadcast.callUpdated(call);
        console.log(`📞 Outgoing call to: ${outgoingNumber} (linkedid: ${call.linkedid})`);
      }
    } catch (error) {
      console.error('❌ Failed to handle DialBegin:', error.message);
    }
  }

  async handleDialEnd(fields) {
    const status = fields.DialStatus || '';
    const linkedid = fields.Linkedid;
    if (!linkedid) return;

    try {
      const call = await Call.findOne({ linkedid });
      if (call) {
        call.dial_status = status;
        const statusMap = {
          'ANSWER': 'answered',
          'BUSY': 'busy',
          'NOANSWER': 'no_answer',
          'CANCEL': 'canceled',
          'CONGESTION': 'congestion'
        };
        if (statusMap[status]) {
          call.disposition = statusMap[status];
        }
        await call.save();
        
        // Broadcast call disposition update
        broadcast.callUpdated(call);
        console.log(`📡 Call disposition updated: ${status} -> ${call.disposition} (linkedid: ${call.linkedid})`);
      }
    } catch (error) {
      console.error('❌ Failed to handle DialEnd:', error.message);
    }
  }

  async handleBridgeEnter(fields) {
    let linkedid = fields.Linkedid;
    if (!linkedid && fields.Uniqueid) {
      const leg = await CallLeg.findOne({ uniqueid: fields.Uniqueid });
      linkedid = leg ? leg.linkedid : null;
    }
    if (!linkedid) return;

    try {
      const call = await Call.findOne({ linkedid });
      if (!call) return;

      const now = new Date();
      if (!call.answered_at) {
        call.answered_at = now;
        if (call.started_at) {
          call.ring_seconds = Math.max(0, Math.floor((now - call.started_at) / 1000));
        }
      }

      if (!call.agent_exten) {
        const channel = fields.Channel || '';
        const match = channel.match(/(?:SIP|PJSIP|Local)\/(\d{3,5})/);
        if (match) {
          call.agent_exten = match[1];
        }
      }

      await call.save();

      // Broadcast call bridge update
      broadcast.callUpdated(call);

      // Create bridge segment
      await BridgeSegment.create({
        linkedid,
        agent_exten: call.agent_exten,
        party_channel: fields.Channel,
        entered_at: now
      });

      console.log(`🌉 Bridge entered: ${linkedid}`);
    } catch (error) {
      console.error('❌ Failed to handle BridgeEnter:', error.message);
    }
  }

  async handleBridgeLeave(fields) {
    let linkedid = fields.Linkedid;
    if (!linkedid && fields.Uniqueid) {
      const leg = await CallLeg.findOne({ uniqueid: fields.Uniqueid });
      linkedid = leg ? leg.linkedid : null;
    }
    if (!linkedid) return;

    try {
      const channel = fields.Channel || '';
      const segment = await BridgeSegment.findOne({
        linkedid,
        left_at: null,
        ...(channel && { party_channel: channel })
      }).sort({ entered_at: -1 });

      if (segment) {
        segment.left_at = new Date();
        await segment.save();
        console.log(`🌉 Bridge left: ${linkedid}`);
      }
    } catch (error) {
      console.error('❌ Failed to handle BridgeLeave:', error.message);
    }
  }

  /**
   * Handle ExtensionStatus events from AMI
   * IMPORTANT: This method ONLY updates existing extensions in the database.
   * It NEVER creates new extensions automatically to prevent database pollution
   * with AMI-generated codes like *47*1001*600.
   */
  async handleExtensionStatus(fields) {
    const extension = fields.Exten;
    const statusCode = fields.Status;
    const statusText = fields.StatusText;

    if (!extension || statusCode === null) {
      console.warn('⚠️ ExtensionStatus event missing required fields: Exten or Status');
      return;
    }

    // Validate extension format - only allow clean numeric extensions
    // Reject AMI-generated codes like *47*1001*600, *47*1001, etc.
    if (!/^\d{3,4}$/.test(extension)) {
      console.log(`🚫 Skipping AMI-generated extension code: ${extension} (Status: ${statusCode}, Text: ${statusText})`);
      return;
    }

    try {
      // Map status code to device state
      const deviceState = this.mapDeviceState(statusCode, statusText);
      
      // Update extension with new fields (only if it exists in database)
      const updatedExtension = await Extension.updateStatus(extension, statusCode, deviceState);
      
      // Broadcast extension status update only if update was successful
      if (updatedExtension) {
        broadcast.extensionStatusUpdated(updatedExtension);
        console.log(`📱 Extension status updated: ${extension} -> ${statusCode} (${statusText}) -> ${deviceState}`);
      } else {
        console.log(`⚠️ Extension ${extension} not found in database - status update skipped`);
      }
    } catch (error) {
      console.error('❌ Failed to update extension status:', error.message);
    }
  }

  mapDeviceState(statusCode, statusText) {
    const deviceStateMap = {
      0: 'NOT_INUSE',      // NotInUse
      1: 'INUSE',          // InUse
      2: 'BUSY',           // Busy
      4: 'UNAVAILABLE',    // Unavailable
      8: 'RINGING',        // Ringing
      16: 'RING*INUSE',    // Ringinuse
      '-1': 'UNKNOWN'      // Unknown
    };
    
    return deviceStateMap[statusCode] || 'UNKNOWN';
  }

  mapExtensionStatus(asteriskStatus) {
    const numericStatusMap = {
      '0': 'online',    // NotInUse
      '1': 'online',    // InUse
      '2': 'online',    // Busy
      '4': 'offline',   // Unavailable
      '8': 'online',    // Ringing
      '16': 'online',   // Ringinuse
      '-1': 'unknown'   // Unknown
    };

    const textStatusMap = {
      'Registered': 'online',
      'Unregistered': 'offline',
      'Rejected': 'offline',
      'Timeout': 'offline',
      'NotInUse': 'online',
      'InUse': 'online',
      'Busy': 'online',
      'Unavailable': 'offline',
      'Ringing': 'online',
      'Ringinuse': 'online',
      'Unknown': 'unknown'
    };

    if (numericStatusMap[asteriskStatus]) {
      return numericStatusMap[asteriskStatus];
    }

    if (textStatusMap[asteriskStatus]) {
      return textStatusMap[asteriskStatus];
    }

    console.warn('⚠️ Unknown extension status value:', asteriskStatus);
    return 'unknown';
  }

  stop() {
    if (this.socket) {
      this.connected = false;
      this.socket.end();
      console.log('🛑 AMI Listener stopped');
    }
  }
}

export default AmiListener;