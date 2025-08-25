import mongoose from 'mongoose';

const callLegSchema = new mongoose.Schema({
  uniqueid: {
    type: String,
    required: true,
    unique: true
  },
  linkedid: {
    type: String,
    required: true
  },
  channel: {
    type: String,
    default: null
  },
  exten: {
    type: String,
    default: null
  },
  context: {
    type: String,
    default: null
  },
  channel_state: {
    type: String,
    default: null
  },
  channel_state_desc: {
    type: String,
    default: null
  },
  state: {
    type: String,
    default: null
  },
  callerid_num: {
    type: String,
    default: null
  },
  callerid_name: {
    type: String,
    default: null
  },
  connected_line_num: {
    type: String,
    default: null
  },
  connected_line_name: {
    type: String,
    default: null
  },
  start_time: {
    type: Date,
    default: null
  },
  hangup_at: {
    type: Date,
    default: null
  },
  hangup_cause: {
    type: String,
    default: null
  }
}, {
  timestamps: true,
  versionKey: false
});

// Indexes for better query performance
callLegSchema.index({ uniqueid: 1 }); // Unique index (declared above as unique)
callLegSchema.index({ linkedid: 1 });
callLegSchema.index({ channel: 1 });
callLegSchema.index({ start_time: -1 });
callLegSchema.index({ hangup_at: 1 });
callLegSchema.index({ linkedid: 1, hangup_at: 1 }); // Compound for active legs query

const CallLeg = mongoose.model('CallLeg', callLegSchema);

export default CallLeg;