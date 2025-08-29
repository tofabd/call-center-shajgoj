import mongoose from 'mongoose';

const extensionSchema = new mongoose.Schema({
  // 1. IDENTIFICATION
  extension: {
    type: String,
    required: true,
    unique: true,
    index: true,
    validate: {
      validator: function(v) {
        return /^\d{3,5}$/.test(v);
      },
      message: 'Extension must be 3-5 digits'
    }
  },
  
  agent_name: {
    type: String,
    default: null,
    trim: true,
    maxlength: 100
  },
  
  // 2. STATUS INFORMATION
  status_code: {
    type: Number,
    required: true,
    min: -1,
    max: 16,
    index: true,
    validate: {
      validator: function(v) {
        return [-1, 0, 1, 2, 4, 8, 16].includes(v);
      },
      message: 'Invalid Asterisk status code'
    }
  },
  
  device_state: {
    type: String,
    required: true,
    enum: [
      'NOT_INUSE', 'INUSE', 'BUSY', 'INVALID', 'UNAVAILABLE',
      'RINGING', 'RING*INUSE', 'ONHOLD', 'UNKNOWN'
    ],
    index: true
  },
  
  status: {
    type: String,
    enum: ['online', 'offline', 'unknown'],
    default: 'unknown',
    index: true
  },
  
  // 3. TIMESTAMPS
  last_status_change: {
    type: Date,
    default: null,
    index: true
  },
  
  last_seen: {
    type: Date,
    default: null,
    index: true
  },
  
  // 4. CONFIGURATION
  is_active: {
    type: Boolean,
    default: true,
    index: true
  },
  
  department: {
    type: String,
    default: null,
    index: true
  }
  
}, {
  timestamps: true,
  versionKey: false,
  collection: 'extensions'
});

// PERFORMANCE INDEXES
extensionSchema.index({ status: 1, is_active: 1 });
extensionSchema.index({ device_state: 1, is_active: 1 });
extensionSchema.index({ department: 1, is_active: 1 });
extensionSchema.index({ last_status_change: -1 });
extensionSchema.index({ last_seen: -1 });

// STATUS UPDATE METHOD
extensionSchema.statics.updateStatus = async function(extension, statusCode, deviceState) {
  const now = new Date();
  return this.findOneAndUpdate(
    { extension },
    { 
      status_code: statusCode,
      device_state: deviceState,
      status: this.mapStatus(statusCode),
      last_status_change: now,
      last_seen: now,
      $setOnInsert: { 
        agent_name: null,
        is_active: true,
        department: null
      }
    },
    { 
      upsert: true, 
      new: true,
      setDefaultsOnInsert: true
    }
  );
};

// STATUS MAPPING
extensionSchema.statics.mapStatus = function(statusCode) {
  const statusMap = {
    0: 'online',    // NotInUse
    1: 'online',    // InUse
    2: 'online',    // Busy
    4: 'offline',   // Unavailable
    8: 'online',    // Ringing
    16: 'online',   // Ringinuse
    '-1': 'unknown' // Unknown
  };
  return statusMap[statusCode] || 'unknown';
};

// UTILITY METHODS
extensionSchema.methods.isAvailable = function() {
  return this.status === 'online' && this.is_active;
};

extensionSchema.methods.getStatusLabel = function() {
  if (this.device_state === 'INUSE') return 'On Call';
  if (this.device_state === 'RINGING') return 'Ringing';
  if (this.device_state === 'BUSY') return 'Busy';
  if (this.status === 'online') return 'Available';
  return 'Unavailable';
};

const Extension = mongoose.model('Extension', extensionSchema);

export default Extension;