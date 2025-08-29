import mongoose from 'mongoose';

const bridgeSegmentSchema = new mongoose.Schema({
  linkedid: {
    type: String,
    required: true,
    index: true
  },
  agent_exten: {
    type: String,
    required: true,
    index: true
  },
  party_channel: {
    type: String,
    required: true
  },
  entered_at: {
    type: Date,
    required: true,
    default: Date.now
  },
  left_at: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  collection: 'bridge_segments'
});

// Indexes for efficient querying
bridgeSegmentSchema.index({ linkedid: 1, entered_at: 1 });
bridgeSegmentSchema.index({ agent_exten: 1, entered_at: 1 });

// Virtual for duration calculation
bridgeSegmentSchema.virtual('duration').get(function() {
  if (this.left_at && this.entered_at) {
    return Math.floor((this.left_at - this.entered_at) / 1000);
  }
  return null;
});

// Ensure virtual fields are serialized
bridgeSegmentSchema.set('toJSON', { virtuals: true });
bridgeSegmentSchema.set('toObject', { virtuals: true });

// Static method to find bridge segments by linkedid
bridgeSegmentSchema.statics.findByLinkedId = function(linkedid) {
  return this.find({ linkedid }).sort({ entered_at: 1 });
};

// Static method to find bridge segments by agent extension
bridgeSegmentSchema.statics.findByAgentExtension = function(agentExten) {
  return this.find({ agent_exten: agentExten }).sort({ entered_at: -1 });
};

// Instance method to mark segment as left
bridgeSegmentSchema.methods.markAsLeft = function() {
  this.left_at = new Date();
  return this.save();
};

// Instance method to check if segment is active
bridgeSegmentSchema.methods.isActive = function() {
  return !this.left_at;
};

const BridgeSegment = mongoose.model('BridgeSegment', bridgeSegmentSchema);

export default BridgeSegment;
