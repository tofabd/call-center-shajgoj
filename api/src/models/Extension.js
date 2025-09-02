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

// STATUS UPDATE METHOD - UPDATES EXISTING OR CREATES NEW EXTENSIONS
extensionSchema.statics.updateStatus = async function(extension, statusCode, deviceState) {
  const now = new Date();
  
  // Check if extension exists
  const existingExtension = await this.findOne({ extension });
  
  if (!existingExtension) {
    console.log(`📝 Extension ${extension} not found in database - creating new entry`);
    return await this.createOrUpdateFromAMI(extension, statusCode, deviceState);
  }
  
  // ALWAYS update extension status, even if inactive (for real-time monitoring)
  // Only log if inactive, but still update and broadcast
  if (!existingExtension.is_active) {
    console.log(`⚠️ Extension ${extension} is inactive but updating status for monitoring`);
  }
  
  // Update existing extension (active or inactive)
  return this.findOneAndUpdate(
    { extension },
    { 
      status_code: statusCode,
      device_state: deviceState,
      status: this.mapStatus(statusCode),
      last_status_change: now,
      last_seen: now
    },
    { 
      new: true
    }
  );
};

// AUTO-CREATE OR UPDATE METHOD - for AMI refresh process
extensionSchema.statics.createOrUpdateFromAMI = async function(extension, statusCode, deviceState) {
  const now = new Date();
  
  // Validate extension format
  if (!/^\d{3,5}$/.test(extension)) {
    console.log(`⚠️ Invalid extension format: ${extension} - skipping`);
    return null;
  }
  
  // Try to update existing extension first
  const updated = await this.findOneAndUpdate(
    { extension },
    {
      status_code: statusCode,
      device_state: deviceState,
      status: this.mapStatus(statusCode),
      last_status_change: now,
      last_seen: now,
      is_active: true // Ensure AMI-found extensions are active
    },
    { 
      new: true,
      upsert: false // Don't create if not exists, handle manually
    }
  );
  
  if (updated) {
    return updated;
  }
  
  // Create new extension if not exists
  try {
    const newExtension = new this({
      extension: extension,
      agent_name: `Agent ${extension}`, // Default name
      department: this.getDepartmentByExtension(extension),
      status_code: statusCode,
      device_state: deviceState,
      status: this.mapStatus(statusCode),
      is_active: true,
      last_status_change: now,
      last_seen: now
    });
    
    const saved = await newExtension.save();
    console.log(`✅ Created new extension: ${extension} with status ${deviceState}`);
    return saved;
    
  } catch (error) {
    console.error(`❌ Error creating extension ${extension}:`, error.message);
    return null;
  }
};

// DEPARTMENT ASSIGNMENT HELPER
extensionSchema.statics.getDepartmentByExtension = function(extension) {
  const ext = parseInt(extension);
  if (ext >= 2000 && ext < 3000) return 'Sales';
  if (ext >= 1000 && ext < 2000) return 'Support';
  if (ext >= 5000) return 'Administration';
  return 'General';
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

// EXPLICIT EXTENSION CREATION METHOD - for manual creation only
extensionSchema.statics.createExtension = async function(extensionData) {
  // Validate extension format - aligned with schema validation (3-5 digits)
  if (!/^\d{3,5}$/.test(extensionData.extension)) {
    throw new Error(`Invalid extension format: ${extensionData.extension}. Must be 3-5 digits only.`);
  }
  
  // Check if extension already exists
  const existing = await this.findOne({ extension: extensionData.extension });
  if (existing) {
    throw new Error(`Extension ${extensionData.extension} already exists in database.`);
  }
  
  // Create new extension with validation
  const newExtension = new this({
    extension: extensionData.extension,
    agent_name: extensionData.agent_name || null,
    department: extensionData.department || null,
    status: 'unknown',
    status_code: -1,
    device_state: 'UNKNOWN',
    is_active: true,
    last_status_change: null,
    last_seen: null
  });
  
  return await newExtension.save();
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