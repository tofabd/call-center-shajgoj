import Call from '../models/Call.js';
import CallLeg from '../models/CallLeg.js';
import BridgeSegment from '../models/BridgeSegment.js';

// Get all calls with pagination and filtering
export const getCalls = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      status,
      direction,
      agent_exten,
      start_date,
      end_date,
      search
    } = req.query;

    // Build filter query
    const filter = {};
    
    // Note: status filtering is now handled by the virtual field in the model
    // We'll filter by status after fetching the data
    if (direction) filter.direction = direction;
    if (agent_exten) filter.agent_exten = agent_exten;
    
    if (start_date || end_date) {
      filter.started_at = {};
      if (start_date) filter.started_at.$gte = new Date(start_date);
      if (end_date) filter.started_at.$lte = new Date(end_date);
    }

    if (search) {
      filter.$or = [
        { other_party: { $regex: search, $options: 'i' } },
        { caller_number: { $regex: search, $options: 'i' } },
        { caller_name: { $regex: search, $options: 'i' } },
        { agent_exten: { $regex: search, $options: 'i' } }
      ];
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    let calls = await Call.find(filter)
      .sort({ started_at: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Filter by status if provided (using derived status from disposition)
    if (status) {
      calls = calls.filter(call => {
        // Derive status from call state using disposition
        let callStatus;
        if (call.ended_at) {
          // Call has ended - use disposition or default to 'ended'
          callStatus = call.disposition || 'ended';
        } else if (call.answered_at) {
          // Call is answered but not ended
          callStatus = 'answered';
        } else {
          // Call is not answered and not ended
          callStatus = 'ringing';
        }
        return callStatus === status;
      });
    }

    // Transform MongoDB data to frontend format
    const transformedCalls = calls.map(call => {
      // Derive status from call state using disposition
      let status;
      if (call.ended_at) {
        // Call has ended - use disposition or default to 'ended'
        status = call.disposition || 'ended';
      } else if (call.answered_at) {
        // Call is answered but not ended
        status = 'answered';
      } else {
        // Call is not answered and not ended
        status = 'ringing';
      }
      
      return {
        id: call._id.toString(), // Use ObjectId as string directly
        callerNumber: call.caller_number || call.other_party || call.linkedid,
        callerName: call.caller_name,
        startTime: call.started_at,
        endTime: call.ended_at,
        status: status,
        duration: call.talk_seconds || 
                  (call.ended_at && call.started_at ? 
                    Math.floor((new Date(call.ended_at).getTime() - new Date(call.started_at).getTime()) / 1000) : 
                    undefined),
        direction: call.direction,
        agentExten: call.agent_exten,
        otherParty: call.other_party
      };
    });

    const total = await Call.countDocuments(filter);
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: transformedCalls,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCalls: total,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching calls',
      error: error.message
    });
  }
};

// Get call by ID with related data
export const getCallById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const call = await Call.findById(id);
    if (!call) {
      return res.status(404).json({
        success: false,
        message: 'Call not found'
      });
    }

    // Get related call legs and bridge segments
    const [callLegs, bridgeSegments] = await Promise.all([
      CallLeg.find({ linkedid: call.linkedid }).sort({ start_time: 1 }),
      BridgeSegment.find({ linkedid: call.linkedid }).sort({ entered_at: 1 })
    ]);

    res.json({
      success: true,
      data: {
        call: call.toJSON(),
        callLegs,
        bridgeSegments
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching call details',
      error: error.message
    });
  }
};

// Get call statistics
export const getCallStatistics = async (req, res) => {
  try {
    const { 
      start_date = new Date(Date.now() - 24 * 60 * 60 * 1000), // Default: last 24 hours
      end_date = new Date(),
      agent_exten 
    } = req.query;

    const dateFilter = {
      started_at: {
        $gte: new Date(start_date),
        $lte: new Date(end_date)
      }
    };

    if (agent_exten) {
      dateFilter.agent_exten = agent_exten;
    }

    // Get all calls in date range for status calculation
    const calls = await Call.find(dateFilter).lean();

    // Calculate status-based statistics using virtual status logic
    let answeredCalls = 0;
    let missedCalls = 0;
    const statusCounts = {};

    calls.forEach(call => {
      // Derive status from call state using disposition instead of status field
      let status;
      if (call.ended_at) {
        // Call has ended - use disposition or default to 'ended'
        status = call.disposition || 'ended';
      } else if (call.answered_at) {
        // Call is answered but not ended
        status = 'answered';
      } else {
        // Call is not answered and not ended
        status = 'ringing';
      }
      
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      
      if (status === 'answered') {
        answeredCalls++;
      } else if (['ended', 'busy', 'no_answer', 'failed', 'congestion', 'chanunavail'].includes(status) && !call.answered_at) {
        missedCalls++;
      }
    });

    // Aggregate other statistics
    const [
      totalCalls,
      callsByDirection,
      averageStats
    ] = await Promise.all([
      Call.countDocuments(dateFilter),
      Call.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$direction', count: { $sum: 1 } } }
      ]),
      Call.aggregate([
        { $match: { ...dateFilter, answered_at: { $ne: null } } },
        {
          $group: {
            _id: null,
            avgRingTime: { $avg: '$ring_seconds' },
            avgTalkTime: { $avg: '$talk_seconds' },
            totalTalkTime: { $sum: '$talk_seconds' }
          }
        }
      ])
    ]);

    // Calculate answer rate
    const answerRate = totalCalls > 0 ? (answeredCalls / totalCalls * 100).toFixed(2) : 0;

    // Format direction and status statistics
    const directionStats = {};
    callsByDirection.forEach(item => {
      directionStats[item._id] = item.count;
    });

    const avgData = averageStats[0] || {};

    res.json({
      success: true,
      data: {
        summary: {
          totalCalls,
          answeredCalls,
          missedCalls,
          answerRate: parseFloat(answerRate)
        },
        byDirection: {
          incoming: directionStats.incoming || 0,
          outgoing: directionStats.outgoing || 0
        },
        byStatus: statusCounts,
        averages: {
          ringTime: Math.round(avgData.avgRingTime || 0),
          talkTime: Math.round(avgData.avgTalkTime || 0),
          totalTalkTime: Math.round(avgData.totalTalkTime || 0)
        },
        dateRange: {
          start: start_date,
          end: end_date
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching call statistics',
      error: error.message
    });
  }
};

// Get live/active calls
export const getLiveCalls = async (req, res) => {
  try {
    const liveCalls = await Call.find({
      $or: [
        { ended_at: null }, // Any call without an end time
        { answered_at: { $ne: null }, ended_at: null } // Answered calls that haven't ended
      ]
    }).sort({ started_at: -1 });

    // Transform to include derived status from disposition for frontend consistency
    const transformedCalls = liveCalls.map(call => {
      const callData = call.toJSON();
      
      // Derive status from call state using disposition
      if (call.ended_at) {
        // Call has ended - use disposition or default to 'ended'
        callData.status = call.disposition || 'ended';
      } else if (call.answered_at) {
        // Call is answered but not ended
        callData.status = 'answered';
      } else {
        // Call is not answered and not ended
        callData.status = 'ringing';
      }
      
      return callData;
    });

    res.json({
      success: true,
      data: transformedCalls
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching live calls',
      error: error.message
    });
  }
};

// Get call details for modal
export const getCallDetails = async (req, res) => {
  try {
    const { id } = req.params;
    
    const call = await Call.findById(id);
    if (!call) {
      return res.status(404).json({
        success: false,
        message: 'Call not found'
      });
    }

    // Get related call legs and bridge segments
    const [callLegs, bridgeSegments] = await Promise.all([
      CallLeg.find({ linkedid: call.linkedid }).sort({ start_time: 1 }),
      BridgeSegment.find({ linkedid: call.linkedid }).sort({ entered_at: 1 })
    ]);

    // Get the master/first call leg to extract additional details
    const masterCallLeg = callLegs.find(leg => leg.uniqueid === call.linkedid) || callLegs[0];

    // Transform call legs to match frontend CallFlowStep interface
    const callFlow = callLegs.map(leg => ({
      uniqueid: leg.uniqueid,
      channel: leg.channel,
      exten: leg.exten,
      context: leg.context,
      channel_state: leg.channel_state,
      channel_state_desc: leg.channel_state_desc,
      state: leg.state,
      callerid_num: leg.callerid_num,
      callerid_name: leg.callerid_name,
      connected_line_num: leg.connected_line_num,
      connected_line_name: leg.connected_line_name,
      start_time: leg.start_time,
      answer_at: leg.answer_at,
      hangup_at: leg.hangup_at,
      hangup_cause: leg.hangup_cause,
      agent_exten_if_leg: null, // This would need to be derived based on business logic
      other_party_if_leg: null,  // This would need to be derived based on business logic
      step_type: leg.channel?.includes('SIP') ? 'trunk_connection' : 'master_channel',
      step_description: `Call leg ${leg.channel || 'Unknown'}`
    }));

    // Calculate duration if not available
    const calculatedDuration = call.talk_seconds || 
      (call.ended_at && call.started_at ? 
        Math.floor((new Date(call.ended_at).getTime() - new Date(call.started_at).getTime()) / 1000) : 
        null);

    res.json({
      success: true,
      data: {
        // Basic call information
        id: call._id.toString(),
        uniqueid: call.linkedid, // Using linkedid as uniqueid for the main call
        linkedid: call.linkedid,
        channel: masterCallLeg?.channel || null,
        callerNumber: call.caller_number || call.other_party,
        callerName: call.caller_name,
        extension: call.agent_exten,
        context: masterCallLeg?.context || null,
        channelState: masterCallLeg?.channel_state || null,
        channelStateDesc: masterCallLeg?.channel_state_desc || null,
        connectedLineNum: masterCallLeg?.connected_line_num || null,
        connectedLineName: masterCallLeg?.connected_line_name || null,
        state: masterCallLeg?.state || null,
        startTime: call.started_at,
        endTime: call.ended_at,
        status: call.ended_at ? (call.disposition || 'ended') : (call.answered_at ? 'answered' : 'ringing'),
        duration: calculatedDuration,
        callInstanceId: null, // Not available in current schema
        createdAt: call.createdAt,
        updatedAt: call.updatedAt,
        direction: call.direction,
        agentExten: call.agent_exten,
        otherParty: call.other_party,
        callFlow: callFlow,
        extensionChanges: [] // This would need to be implemented based on business logic
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching call details',
      error: error.message
    });
  }
};