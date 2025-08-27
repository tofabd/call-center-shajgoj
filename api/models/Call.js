import mongoose from 'mongoose';

const callSchema = new mongoose.Schema({
  linkedid: {
    type: String,
    required: true,
    unique: true
  },
  direction: {
    type: String,
    enum: ['incoming', 'outgoing'],
    default: null
  },
  other_party: {
    type: String,
    default: null
  },
  agent_exten: {
    type: String,
    default: null
  },
  started_at: {
    type: Date,
    default: Date.now
  },
  answered_at: {
    type: Date,
    default: null
  },
  ended_at: {
    type: Date,
    default: null
  },
  ring_seconds: {
    type: Number,
    default: null
  },
  talk_seconds: {
    type: Number,
    default: null
  },
  dial_status: {
    type: String,
    default: null
  },
  disposition: {
    type: String,
    enum: ['answered', 'busy', 'no_answer', 'canceled', 'congestion'],
    default: null
  },
  hangup_cause: {
    type: String,
    default: null
  },
  caller_number: {
    type: String,
    default: null
  },
  caller_name: {
    type: String,
    default: null
  }
}, {
  timestamps: true,
  versionKey: false
});

// Indexes for better query performance
callSchema.index({ linkedid: 1 }); // Unique index (declared above as unique)
callSchema.index({ started_at: -1 });
callSchema.index({ direction: 1 });
callSchema.index({ other_party: 1 });
callSchema.index({ agent_exten: 1 });
callSchema.index({ agent_exten: 1, started_at: -1 }); // Compound index

// Virtual for duration calculation
callSchema.virtual('duration').get(function() {
  if (!this.started_at) return null;
  const endTime = this.ended_at || new Date();
  return Math.floor((endTime - this.started_at) / 1000);
});

// Virtual for call status based on other fields
callSchema.virtual('status').get(function() {
  if (this.ended_at) {
    if (this.answered_at) {
      return 'ended';
    } else {
      return this.disposition || 'ended';
    }
  } else if (this.answered_at) {
    return 'answered';
  } else {
    return 'ringing';
  }
});

// Ensure virtual fields are serialized
callSchema.set('toJSON', { virtuals: true });

const Call = mongoose.model('Call', callSchema);

export default Call;