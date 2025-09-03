import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    default: '',
    maxlength: 500
  },
  department: {
    type: String,
    default: '',
    maxlength: 100
  },
  manager_name: {
    type: String,
    default: '',
    maxlength: 100
  },
  manager_email: {
    type: String,
    default: '',
    maxlength: 255,
    lowercase: true,
    validate: {
      validator: function(v) {
        return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Invalid email format'
    }
  },
  max_members: {
    type: Number,
    default: null,
    min: 1,
    max: 1000
  },
  is_active: {
    type: Boolean,
    default: true
  },
  created_by: {
    type: String,
    default: 'system',
    maxlength: 100
  },
  updated_by: {
    type: String,
    default: 'system',
    maxlength: 100
  }
}, {
  timestamps: true,
  versionKey: false
});

// Indexes for better query performance
teamSchema.index({ name: 1 }, { unique: true });
teamSchema.index({ department: 1 });
teamSchema.index({ is_active: 1 });
teamSchema.index({ created_by: 1 });

// Virtual for member count (would need to be populated from User model)
teamSchema.virtual('member_count').get(function() {
  return this._member_count || 0;
});

// Ensure virtual fields are serialized
teamSchema.set('toJSON', { virtuals: true });

// Pre-save middleware to ensure name uniqueness case-insensitive
teamSchema.pre('save', async function(next) {
  if (this.isModified('name')) {
    const existingTeam = await mongoose.model('Team').findOne({
      name: new RegExp(`^${this.name}$`, 'i'),
      _id: { $ne: this._id }
    });
    
    if (existingTeam) {
      const error = new Error('Team name already exists');
      error.code = 'DUPLICATE_TEAM_NAME';
      return next(error);
    }
  }
  next();
});

const Team = mongoose.model('Team', teamSchema);

export default Team;