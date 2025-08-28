import Extension from '../models/Extension.js';
import { getAmiQueryService } from '../services/AmiQueryServiceInstance.js';

// Get all extensions with filtering
export const getExtensions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 100,
      status,
      is_active,
      search
    } = req.query;

    // Build filter query
    const filter = {};
    
    if (status) filter.status = status;
    if (is_active !== undefined) filter.is_active = is_active === 'true';
    
    if (search) {
      filter.$or = [
        { extension: { $regex: search, $options: 'i' } },
        { agent_name: { $regex: search, $options: 'i' } }
      ];
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const extensions = await Extension.find(filter)
      .sort({ extension: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Extension.countDocuments(filter);
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: extensions,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalExtensions: total,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching extensions',
      error: error.message
    });
  }
};

// Get extension by ID
export const getExtensionById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const extension = await Extension.findById(id);
    if (!extension) {
      return res.status(404).json({
        success: false,
        message: 'Extension not found'
      });
    }

    res.json({
      success: true,
      data: extension
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching extension',
      error: error.message
    });
  }
};

// Create new extension
export const createExtension = async (req, res) => {
  try {
    const {
      extension,
      agent_name,
      department,
      is_active = true
    } = req.body;

    // Validation
    if (!extension) {
      return res.status(400).json({
        success: false,
        message: 'Extension number is required'
      });
    }

    // Check if extension already exists
    const existingExtension = await Extension.findOne({ extension });
    if (existingExtension) {
      return res.status(409).json({
        success: false,
        message: 'Extension already exists'
      });
    }

    const now = new Date();
    const newExtension = new Extension({
      extension,
      agent_name,
      department,
      is_active,
      status_code: 0,
      device_state: 'NOT_INUSE',
      status: 'unknown',
      last_status_change: now,
      last_seen: now
    });

    await newExtension.save();

    res.status(201).json({
      success: true,
      message: 'Extension created successfully',
      data: newExtension
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating extension',
      error: error.message
    });
  }
};

// Update extension
export const updateExtension = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    delete updateData.status_code;
    delete updateData.device_state;
    delete updateData.status;
    delete updateData.last_status_change;

    const extension = await Extension.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!extension) {
      return res.status(404).json({
        success: false,
        message: 'Extension not found'
      });
    }

    res.json({
      success: true,
      message: 'Extension updated successfully',
      data: extension
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating extension',
      error: error.message
    });
  }
};

// Delete extension
export const deleteExtension = async (req, res) => {
  try {
    const { id } = req.params;
    
    const extension = await Extension.findByIdAndDelete(id);
    if (!extension) {
      return res.status(404).json({
        success: false,
        message: 'Extension not found'
      });
    }

    res.json({
      success: true,
      message: 'Extension deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting extension',
      error: error.message
    });
  }
};

// Update extension status (used by AMI)
export const updateExtensionStatus = async (req, res) => {
  try {
    const { extension, status } = req.body;

    if (!extension || !status) {
      return res.status(400).json({
        success: false,
        message: 'Extension and status are required'
      });
    }

    const updatedExtension = await Extension.updateStatus(extension, status);

    res.json({
      success: true,
      message: 'Extension status updated successfully',
      data: updatedExtension
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating extension status',
      error: error.message
    });
  }
};

// Manual refresh extension status
export const refreshExtensionStatus = async (req, res) => {
  try {
    const amiQueryService = getAmiQueryService();
    
    if (!amiQueryService) {
      return res.status(503).json({
        success: false,
        message: 'AMI Query Service not available'
      });
    }

    const result = await amiQueryService.manualRefresh();
    
    res.json({
      success: true,
      message: 'Extension status refresh completed successfully',
      data: result
    });
  } catch (error) {
    console.error('❌ Manual refresh failed:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh extension status',
      error: error.message
    });
  }
};

// Get AMI Query Service status
export const getQueryServiceStatus = async (req, res) => {
  try {
    const amiQueryService = getAmiQueryService();
    
    if (!amiQueryService) {
      return res.json({
        success: true,
        data: {
          connected: false,
          message: 'AMI Query Service not initialized'
        }
      });
    }

    const status = await amiQueryService.getStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching query service status',
      error: error.message
    });
  }
};

// Get extension statistics
export const getExtensionStatistics = async (req, res) => {
  try {
    const [
      totalExtensions,
      activeExtensions,
      onlineExtensions,
      offlineExtensions,
      unknownExtensions,
      statusBreakdown
    ] = await Promise.all([
      Extension.countDocuments(),
      Extension.countDocuments({ is_active: true }),
      Extension.countDocuments({ status: 'online', is_active: true }),
      Extension.countDocuments({ status: 'offline', is_active: true }),
      Extension.countDocuments({ status: 'unknown', is_active: true }),
      Extension.aggregate([
        { $match: { is_active: true } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ])
    ]);

    const statusStats = {};
    statusBreakdown.forEach(item => {
      statusStats[item._id] = item.count;
    });

    res.json({
      success: true,
      data: {
        summary: {
          total: totalExtensions,
          active: activeExtensions,
          online: onlineExtensions,
          offline: offlineExtensions,
          unknown: unknownExtensions
        },
        byStatus: statusStats,
        onlinePercentage: activeExtensions > 0 ? ((onlineExtensions / activeExtensions) * 100).toFixed(2) : 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching extension statistics',
      error: error.message
    });
  }
};