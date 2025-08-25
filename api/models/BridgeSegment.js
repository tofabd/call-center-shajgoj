import mongoose from 'mongoose';

const bridgeSegmentSchema = new mongoose.Schema({
  linkedid: {
    type: String,
    required: true,
    index: true
  },
  agent_exten: {
    type: String,
    default: null,
    index: true
  },
  party_channel: {
    type: String,
    default: null
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
  versionKey: false
});

// Indexes for better query performance
bridgeSegmentSchema.index({ linkedid: 1 });
bridgeSegmentSchema.index({ agent_exten: 1, entered_at: -1 });
bridgeSegmentSchema.index({ entered_at: -1 });

// Virtual for bridge duration
bridgeSegmentSchema.virtual('duration').get(function() {
  if (!this.entered_at) return null;
  const leftTime = this.left_at || new Date();
  return Math.floor((leftTime - this.entered_at) / 1000);
});

// Ensure virtual fields are serialized
bridgeSegmentSchema.set('toJSON', { virtuals: true });

const BridgeSegment = mongoose.model('BridgeSegment', bridgeSegmentSchema);

export default BridgeSegment;