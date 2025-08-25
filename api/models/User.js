import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters long'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  extension: {
    type: String,
    required: [true, 'Extension is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Extension must be at least 3 characters long'],
    maxlength: [10, 'Extension cannot exceed 10 characters']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long'],
    select: false // Don't include password in queries by default
  },
  role: {
    type: String,
    enum: ['agent', 'supervisor', 'admin'],
    default: 'agent'
  },
  department: {
    type: String,
    trim: true,
    maxlength: [30, 'Department cannot exceed 30 characters']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt fields
  versionKey: false // Removes __v field
});

// Indexes for better query performance
// Note: email and extension already have unique: true, so no need for additional indexes
userSchema.index({ isActive: 1 });

// Instance method to get user's full information
userSchema.methods.getPublicProfile = function() {
  const userObject = this.toObject();
  // Remove sensitive fields
  delete userObject.password;
  return userObject;
};

// Instance method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Static method to find active users
userSchema.statics.findActiveUsers = function() {
  return this.find({ isActive: true });
};

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  // Hash password if it's been modified
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  
  // Update lastLogin when isActive changes to true
  if (this.isModified('isActive') && this.isActive) {
    this.lastLogin = new Date();
  }
  
  next();
});

const User = mongoose.model('User', userSchema);

export default User;