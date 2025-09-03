import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 255
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    default: null,
    maxlength: 1000
  },
  is_active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  versionKey: false
});

// Indexes for better query performance
teamSchema.index({ name: 1 });
teamSchema.index({ slug: 1 }, { unique: true });
teamSchema.index({ is_active: 1 });

// Virtual for member count (would need to be populated from User model)
teamSchema.virtual('users_count').get(function() {
  return this._users_count || 0;
});

// Ensure virtual fields are serialized
teamSchema.set('toJSON', { virtuals: true });

// Generate slug from name
function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-'); // Replace multiple hyphens with single hyphen
}

// Pre-save middleware to generate slug and ensure uniqueness
teamSchema.pre('save', async function(next) {
  // Generate slug if name is modified or slug is empty (for new documents)
  if (this.isModified('name') || !this.slug) {
    this.slug = generateSlug(this.name);
    
    // Ensure slug uniqueness
    let baseSlug = this.slug;
    let counter = 1;
    
    while (true) {
      const existingTeam = await mongoose.model('Team').findOne({
        slug: this.slug,
        _id: { $ne: this._id }
      });
      
      if (!existingTeam) break;
      
      this.slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }
  next();
});

const Team = mongoose.model('Team', teamSchema);

export default Team;