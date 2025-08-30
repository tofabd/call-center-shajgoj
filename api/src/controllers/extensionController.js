import Extension from '../models/Extension.js';
import { getAmiQueryService } from '../services/AmiQueryServiceInstance.js';
import { createComponentLogger } from '../config/logging.js';

// Initialize logger for this controller
const logger = createComponentLogger('ExtensionController');

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

    logger.info('📋 Fetching extensions from database', { 
      page, 
      limit, 
      status, 
      is_active, 
      hasSearch: !!search 
    });

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

    logger.info('✅ Extensions fetched successfully', { 
      count: extensions.length, 
      total, 
      totalPages 
    });

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
    logger.error('❌ Error fetching extensions', { error: error.message });
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
    
    logger.info('📋 Fetching extension by ID', { id });
    
    const extension = await Extension.findById(id);
    if (!extension) {
      logger.warn('⚠️ Extension not found', { id });
      return res.status(404).json({
        success: false,
        message: 'Extension not found'
      });
    }

    logger.info('✅ Extension fetched successfully', { id, extension: extension.extension });
    res.json({
      success: true,
      data: extension
    });
  } catch (error) {
    logger.error('❌ Error fetching extension by ID', { id: req.params.id, error: error.message });
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

    logger.info('📝 Creating new extension', { extension, agent_name, department, is_active });

    // Validation
    if (!extension) {
      logger.warn('⚠️ Extension creation failed - missing extension number');
      return res.status(400).json({
        success: false,
        message: 'Extension number is required'
      });
    }

    // Check if extension already exists
    const existingExtension = await Extension.findOne({ extension });
    if (existingExtension) {
      logger.warn('⚠️ Extension creation failed - extension already exists', { extension });
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

    logger.info('✅ Extension created successfully', { 
      id: newExtension._id, 
      extension: newExtension.extension 
    });

    res.status(201).json({
      success: true,
      message: 'Extension created successfully',
      data: newExtension
    });
  } catch (error) {
    logger.error('❌ Error creating extension', { error: error.message });
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

    logger.info('📝 Updating extension', { id, updateData });

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
      logger.warn('⚠️ Extension not found for update', { id });
      return res.status(404).json({
        success: false,
        message: 'Extension not found'
      });
    }

    logger.info('✅ Extension updated successfully', { 
      id, 
      extension: extension.extension 
    });

    res.json({
      success: true,
      message: 'Extension updated successfully',
      data: extension
    });
  } catch (error) {
    logger.error('❌ Error updating extension', { id: req.params.id, error: error.message });
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
    
    logger.info('🗑️ Deleting extension', { id });
    
    const extension = await Extension.findByIdAndDelete(id);
    if (!extension) {
      logger.warn('⚠️ Extension not found for deletion', { id });
      return res.status(404).json({
        success: false,
        message: 'Extension not found'
      });
    }

    logger.info('✅ Extension deleted successfully', { 
      id, 
      extension: extension.extension 
    });

    res.json({
      success: true,
      message: 'Extension deleted successfully'
    });
  } catch (error) {
    logger.error('❌ Error deleting extension', { id: req.params.id, error: error.message });
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

    logger.info('📝 Updating extension status via API', { extension, status });

    if (!extension || !status) {
      logger.warn('⚠️ Extension status update failed - missing parameters', { extension, status });
      return res.status(400).json({
        success: false,
        message: 'Extension and status are required'
      });
    }

    const updatedExtension = await Extension.updateStatus(extension, status);

    if (updatedExtension) {
      logger.info('✅ Extension status updated successfully via API', { 
        extension, 
        status,
        id: updatedExtension._id 
      });
    } else {
      logger.warn('⚠️ Extension status update failed - extension not found or inactive', { extension });
    }

    res.json({
      success: true,
      message: 'Extension status updated successfully',
      data: updatedExtension
    });
  } catch (error) {
    logger.error('❌ Error updating extension status via API', { 
      extension: req.body.extension, 
      error: error.message 
    });
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
    logger.info('🔄 Manual extension refresh triggered via API');
    
    const amiQueryService = getAmiQueryService();
    
    if (!amiQueryService) {
      logger.error('❌ AMI Query Service not available for manual refresh');
      return res.status(503).json({
        success: false,
        message: 'AMI Query Service not available'
      });
    }

    const result = await amiQueryService.manualRefresh();
    
    logger.info('✅ Manual extension refresh completed successfully', {
      extensionsChecked: result.extensionsChecked,
      lastQueryTime: result.lastQueryTime
    });
    
    res.json({
      success: true,
      message: 'Extension status refresh completed successfully',
      data: result
    });
  } catch (error) {
    logger.error('❌ Manual refresh failed', { error: error.message });
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
    logger.info('📊 Fetching AMI Query Service status');
    
    const amiQueryService = getAmiQueryService();
    
    if (!amiQueryService) {
      logger.warn('⚠️ AMI Query Service not initialized');
      return res.json({
        success: true,
        data: {
          connected: false,
          message: 'AMI Query Service not initialized'
        }
      });
    }

    const status = await amiQueryService.getStatus();
    
    logger.info('✅ AMI Query Service status fetched', { 
      connected: status.connected,
      extensionsMonitored: status.extensionsMonitored,
      isQuerying: status.isQuerying
    });
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('❌ Error fetching query service status', { error: error.message });
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
    logger.info('📊 Fetching extension statistics');
    
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

    const stats = {
      summary: {
        total: totalExtensions,
        active: activeExtensions,
        online: onlineExtensions,
        offline: offlineExtensions,
        unknown: unknownExtensions
      },
      byStatus: statusStats,
      onlinePercentage: activeExtensions > 0 ? ((onlineExtensions / activeExtensions) * 100).toFixed(2) : 0
    };

    logger.info('✅ Extension statistics fetched successfully', { 
      total: totalExtensions,
      active: activeExtensions,
      online: onlineExtensions,
      offline: offlineExtensions,
      unknown: unknownExtensions
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('❌ Error fetching extension statistics', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error fetching extension statistics',
      error: error.message
    });
  }
};

// Get extension call statistics for today
export const getExtensionCallStatistics = async (req, res) => {
  try {
    const { id } = req.params;
    
    logger.info('📊 Fetching extension call statistics', { id });
    
    // Get extension details
    const extension = await Extension.findById(id);
    if (!extension) {
      logger.warn('⚠️ Extension not found for call statistics', { id });
      return res.status(404).json({
        success: false,
        message: 'Extension not found'
      });
    }

    // Calculate today's date range (00:00:00 to 23:59:59)
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    // Import Call model for statistics calculation
    const Call = (await import('../models/Call.js')).default;

    // Get calls for this extension today
    const todayCalls = await Call.find({
      agent_exten: extension.extension,
      started_at: { $gte: startOfDay, $lte: endOfDay }
    }).sort({ started_at: -1 }).lean();

    // Calculate statistics
    let totalCalls = 0;
    let answeredCalls = 0;
    let missedCalls = 0;
    let incomingCalls = 0;
    let outgoingCalls = 0;
    const statusCounts = {};
    const directionCounts = {};
    let totalRingTime = 0;
    let totalTalkTime = 0;
    let answeredCallCount = 0;

    todayCalls.forEach(call => {
      totalCalls++;
      
      // Count by direction
      if (call.direction) {
        directionCounts[call.direction] = (directionCounts[call.direction] || 0) + 1;
        if (call.direction === 'incoming') incomingCalls++;
        if (call.direction === 'outgoing') outgoingCalls++;
      }

      // Count by status/disposition
      let callStatus = 'unknown';
      if (call.ended_at) {
        callStatus = call.disposition || 'ended';
      } else if (call.answered_at) {
        callStatus = 'answered';
      } else {
        callStatus = 'ringing';
      }

      statusCounts[callStatus] = (statusCounts[callStatus] || 0) + 1;

      // Count answered vs missed
      if (call.answered_at) {
        answeredCalls++;
        answeredCallCount++;
        if (call.talk_seconds) totalTalkTime += call.talk_seconds;
      } else if (call.ended_at && !call.answered_at) {
        missedCalls++;
      }

      // Accumulate ring time
      if (call.ring_seconds) totalRingTime += call.ring_seconds;
    });

    // Calculate averages
    const avgRingTime = answeredCallCount > 0 ? Math.round(totalRingTime / answeredCallCount) : 0;
    const avgTalkTime = answeredCallCount > 0 ? Math.round(totalTalkTime / answeredCallCount) : 0;
    const answerRate = totalCalls > 0 ? parseFloat((answeredCalls / totalCalls * 100).toFixed(2)) : 0;

    // Get recent calls (last 10) for display
    const recentCalls = todayCalls.slice(0, 10).map(call => ({
      id: call._id,
      linkedid: call.linkedid,
      direction: call.direction,
      other_party: call.other_party,
      started_at: call.started_at,
      answered_at: call.answered_at,
      ended_at: call.ended_at,
      ring_seconds: call.ring_seconds,
      talk_seconds: call.talk_seconds,
      caller_number: call.caller_number,
      caller_name: call.caller_name,
      disposition: call.disposition,
      status: call.ended_at ? (call.disposition || 'ended') : (call.answered_at ? 'answered' : 'ringing')
    }));

    const stats = {
      extension: extension.extension,
      agentName: extension.agent_name || `Extension ${extension.extension}`,
      date: today.toISOString().split('T')[0],
      summary: {
        totalCalls,
        answeredCalls,
        missedCalls,
        answerRate
      },
      byDirection: {
        incoming: incomingCalls,
        outgoing: outgoingCalls
      },
      byStatus: statusCounts,
      averages: {
        ringTime: avgRingTime,
        talkTime: avgTalkTime,
        totalTalkTime: totalTalkTime
      },
      recentCalls
    };

    logger.info('✅ Extension call statistics fetched successfully', {
      extension: extension.extension,
      totalCalls,
      answeredCalls,
      missedCalls,
      answerRate
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('❌ Error fetching extension call statistics', { 
      id: req.params.id, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      message: 'Error fetching extension call statistics',
      error: error.message
    });
  }
};