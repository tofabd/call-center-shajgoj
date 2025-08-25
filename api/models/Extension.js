import mongoose from 'mongoose';

const extensionSchema = new mongoose.Schema({
  extension: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  agent_name: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'unknown'],
    default: 'unknown',
    index: true
  },
  last_seen: {
    type: Date,
    default: null
  },
  is_active: {
    type: Boolean,
    default: true,
    index: true
  },
  context: {
    type: String,
    default: null
  },
  hint: {
    type: String,
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  versionKey: false
});

// Indexes for better query performance
extensionSchema.index({ status: 1, is_active: 1 });
extensionSchema.index({ last_seen: -1 });

// Instance method to get public information
extensionSchema.methods.getPublicInfo = function() {
  const extObject = this.toObject();
  return extObject;
};

// Static method to find active extensions
extensionSchema.statics.findActiveExtensions = function() {
  return this.find({ is_active: true });
};

// Static method to update extension status
extensionSchema.statics.updateStatus = async function(extension, status) {
  const now = new Date();
  return this.findOneAndUpdate(
    { extension },
    { 
      status, 
      last_seen: status === 'online' ? now : undefined,
      $setOnInsert: { 
        agent_name: null,
        is_active: true,
        context: null,
        hint: null,
        metadata: {}
      }
    },
    { 
      upsert: true, 
      new: true,
      setDefaultsOnInsert: true
    }
  );
};

const Extension = mongoose.model('Extension', extensionSchema);

export default Extension;