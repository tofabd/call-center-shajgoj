import User from '../models/User.js';
import mongoose from 'mongoose';

// Get all users
export const getAllUsers = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      role, 
      department, 
      isActive,
      search 
    } = req.query;

    // Build filter object
    const filter = {};
    if (role) filter.role = role;
    if (department) filter.department = new RegExp(department, 'i');
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) {
      filter.$or = [
        { name: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { extension: new RegExp(search, 'i') }
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 }
    };

    const users = await User.find(filter)
      .limit(options.limit * 1)
      .skip((options.page - 1) * options.limit)
      .sort(options.sort)
      .exec();

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      data: users,
      pagination: {
        currentPage: options.page,
        totalPages: Math.ceil(total / options.limit),
        totalUsers: total,
        hasNextPage: options.page < Math.ceil(total / options.limit),
        hasPrevPage: options.page > 1
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
};

// Get user by ID
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user.getPublicProfile()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user',
      error: error.message
    });
  }
};

// Create new user
export const createUser = async (req, res) => {
  try {
    const { name, email, extension, password, role, department, metadata } = req.body;

    // Check if user with email or extension already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { extension }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email 
          ? 'User with this email already exists'
          : 'User with this extension already exists'
      });
    }

    const user = new User({
      name,
      email,
      extension,
      password,
      role,
      department,
      metadata
    });

    const savedUser = await user.save();

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: savedUser.getPublicProfile()
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating user',
      error: error.message
    });
  }
};

// Update user
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    // If email or extension is being updated, check for conflicts
    if (updates.email || updates.extension) {
      const conflictFilter = {
        _id: { $ne: id },
        $or: []
      };

      if (updates.email) conflictFilter.$or.push({ email: updates.email });
      if (updates.extension) conflictFilter.$or.push({ extension: updates.extension });

      const conflictingUser = await User.findOne(conflictFilter);
      if (conflictingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email or extension already exists'
        });
      }
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      data: user.getPublicProfile()
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating user',
      error: error.message
    });
  }
};

// Delete user
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    const user = await User.findByIdAndDelete(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User deleted successfully',
      data: user.getPublicProfile()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting user',
      error: error.message
    });
  }
};

// Get active users only
export const getActiveUsers = async (req, res) => {
  try {
    const users = await User.findActiveUsers();
    
    res.json({
      success: true,
      data: users,
      count: users.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching active users',
      error: error.message
    });
  }
};

// Bulk create users
export const bulkCreateUsers = async (req, res) => {
  try {
    const { users } = req.body;

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Users array is required and cannot be empty'
      });
    }

    const createdUsers = await User.insertMany(users, { ordered: false });

    res.status(201).json({
      success: true,
      message: `${createdUsers.length} users created successfully`,
      data: createdUsers.map(user => user.getPublicProfile())
    });
  } catch (error) {
    if (error.name === 'BulkWriteError') {
      const insertedCount = error.result.insertedCount;
      const errors = error.writeErrors.map(err => ({
        index: err.index,
        message: err.errmsg
      }));

      return res.status(207).json({
        success: false,
        message: `${insertedCount} users created, ${errors.length} failed`,
        insertedCount,
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating users',
      error: error.message
    });
  }
};