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

// Get today's statistics
export const getTodayStats = async (req, res) => {
  try {
    const { agent_exten } = req.query;
    
    // Today's date range (00:00 to 23:59)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const dateFilter = {
      started_at: {
        $gte: startOfToday,
        $lte: endOfToday
      }
    };

    if (agent_exten) {
      dateFilter.agent_exten = agent_exten;
    }

    // Get all calls for today
    const todayCalls = await Call.find(dateFilter).lean();

    // Calculate statistics
    const stats = calculatePeriodStats(todayCalls, 'today', startOfToday, endOfToday);

    // Get hourly breakdown for today
    const hourlyBreakdown = Array.from({ length: 24 }, (_, hour) => {
      const hourStart = new Date(startOfToday);
      hourStart.setHours(hour);
      const hourEnd = new Date(startOfToday);
      hourEnd.setHours(hour + 1);

      const hourCalls = todayCalls.filter(call => {
        const callTime = new Date(call.started_at);
        return callTime >= hourStart && callTime < hourEnd;
      });

      const answered = hourCalls.filter(call => call.answered_at).length;
      const missed = hourCalls.filter(call => !call.answered_at && call.ended_at).length;

      return {
        hour,
        call_count: hourCalls.length,
        answered,
        missed
      };
    });

    // Get yesterday's stats for comparison
    const yesterdayStart = new Date(startOfToday);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(endOfToday);
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

    const yesterdayCalls = await Call.find({
      ...dateFilter,
      started_at: {
        $gte: yesterdayStart,
        $lte: yesterdayEnd
      }
    }).lean();

    const comparison = calculateComparison(todayCalls, yesterdayCalls);

    res.json({
      period: 'today',
      date_range: {
        start: startOfToday.toISOString(),
        end: endOfToday.toISOString(),
        period_name: 'Today'
      },
      ...stats,
      hourly_breakdown: hourlyBreakdown,
      comparison
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching today statistics',
      error: error.message
    });
  }
};

// Get weekly statistics
export const getWeeklyStats = async (req, res) => {
  try {
    const { agent_exten } = req.query;
    
    // This week's date range (Monday to Sunday)
    const now = new Date();
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const dateFilter = {
      started_at: {
        $gte: startOfWeek,
        $lte: endOfWeek
      }
    };

    if (agent_exten) {
      dateFilter.agent_exten = agent_exten;
    }

    // Get all calls for this week
    const weekCalls = await Call.find(dateFilter).lean();

    // Calculate statistics
    const stats = calculatePeriodStats(weekCalls, 'weekly', startOfWeek, endOfWeek);

    // Get daily breakdown for the week
    const dailyBreakdown = [];
    for (let i = 0; i < 7; i++) {
      const dayStart = new Date(startOfWeek);
      dayStart.setDate(startOfWeek.getDate() + i);
      dayStart.setHours(0, 0, 0, 0);
      
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const dayCalls = weekCalls.filter(call => {
        const callTime = new Date(call.started_at);
        return callTime >= dayStart && callTime <= dayEnd;
      });

      const answered = dayCalls.filter(call => call.answered_at).length;
      const missed = dayCalls.filter(call => !call.answered_at && call.ended_at).length;

      dailyBreakdown.push({
        date: dayStart.toISOString().split('T')[0],
        day_name: dayStart.toLocaleDateString('en-US', { weekday: 'long' }),
        call_count: dayCalls.length,
        answered,
        missed
      });
    }

    // Get last week's stats for comparison
    const lastWeekStart = new Date(startOfWeek);
    lastWeekStart.setDate(startOfWeek.getDate() - 7);
    const lastWeekEnd = new Date(endOfWeek);
    lastWeekEnd.setDate(endOfWeek.getDate() - 7);

    const lastWeekCalls = await Call.find({
      ...dateFilter,
      started_at: {
        $gte: lastWeekStart,
        $lte: lastWeekEnd
      }
    }).lean();

    const comparison = calculateComparison(weekCalls, lastWeekCalls);

    res.json({
      period: 'weekly',
      date_range: {
        start: startOfWeek.toISOString(),
        end: endOfWeek.toISOString(),
        period_name: 'This Week'
      },
      ...stats,
      daily_breakdown: dailyBreakdown,
      comparison
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching weekly statistics',
      error: error.message
    });
  }
};

// Get monthly statistics
export const getMonthlyStats = async (req, res) => {
  try {
    const { agent_exten } = req.query;
    
    // This month's date range (1st to last day)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    const dateFilter = {
      started_at: {
        $gte: startOfMonth,
        $lte: endOfMonth
      }
    };

    if (agent_exten) {
      dateFilter.agent_exten = agent_exten;
    }

    // Get all calls for this month
    const monthCalls = await Call.find(dateFilter).lean();

    // Calculate statistics
    const stats = calculatePeriodStats(monthCalls, 'monthly', startOfMonth, endOfMonth);

    // Get daily breakdown for the month
    const dailyBreakdown = [];
    const daysInMonth = endOfMonth.getDate();
    
    for (let i = 1; i <= daysInMonth; i++) {
      const dayStart = new Date(now.getFullYear(), now.getMonth(), i, 0, 0, 0, 0);
      const dayEnd = new Date(now.getFullYear(), now.getMonth(), i, 23, 59, 59, 999);

      const dayCalls = monthCalls.filter(call => {
        const callTime = new Date(call.started_at);
        return callTime >= dayStart && callTime <= dayEnd;
      });

      const answered = dayCalls.filter(call => call.answered_at).length;
      const missed = dayCalls.filter(call => !call.answered_at && call.ended_at).length;

      dailyBreakdown.push({
        date: dayStart.toISOString().split('T')[0],
        day_name: dayStart.toLocaleDateString('en-US', { weekday: 'long' }),
        call_count: dayCalls.length,
        answered,
        missed
      });
    }

    // Get last month's stats for comparison
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    lastMonthEnd.setHours(23, 59, 59, 999);

    const lastMonthCalls = await Call.find({
      ...dateFilter,
      started_at: {
        $gte: lastMonthStart,
        $lte: lastMonthEnd
      }
    }).lean();

    const comparison = calculateComparison(monthCalls, lastMonthCalls);

    res.json({
      period: 'monthly',
      date_range: {
        start: startOfMonth.toISOString(),
        end: endOfMonth.toISOString(),
        period_name: startOfMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      },
      ...stats,
      daily_breakdown: dailyBreakdown,
      comparison
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching monthly statistics',
      error: error.message
    });
  }
};

// Get custom date range statistics  
export const getCustomRangeStats = async (req, res) => {
  try {
    const { start_date, end_date, agent_exten } = req.query;
    
    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'Both start_date and end_date are required'
      });
    }

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    
    // Validate dates
    if (startDate > endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date must be before end date'
      });
    }

    const dateFilter = {
      started_at: {
        $gte: startDate,
        $lte: endDate
      }
    };

    if (agent_exten) {
      dateFilter.agent_exten = agent_exten;
    }

    // Get all calls for the custom range
    const rangeCalls = await Call.find(dateFilter).lean();

    // Calculate statistics
    const stats = calculatePeriodStats(rangeCalls, 'custom', startDate, endDate);

    // Get daily breakdown for the custom range
    const dailyBreakdown = [];
    const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    
    for (let i = 0; i <= daysDiff; i++) {
      const dayStart = new Date(startDate);
      dayStart.setDate(startDate.getDate() + i);
      dayStart.setHours(0, 0, 0, 0);
      
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      
      // Skip if we've gone past the end date
      if (dayStart > endDate) break;

      const dayCalls = rangeCalls.filter(call => {
        const callTime = new Date(call.started_at);
        return callTime >= dayStart && callTime <= dayEnd;
      });

      const answered = dayCalls.filter(call => call.answered_at).length;
      const missed = dayCalls.filter(call => !call.answered_at && call.ended_at).length;

      dailyBreakdown.push({
        date: dayStart.toISOString().split('T')[0],
        day_name: dayStart.toLocaleDateString('en-US', { weekday: 'long' }),
        call_count: dayCalls.length,
        answered,
        missed
      });
    }

    // Calculate comparison with previous period (same number of days before the start date)
    const periodLength = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const previousStart = new Date(startDate);
    previousStart.setDate(previousStart.getDate() - periodLength);
    const previousEnd = new Date(startDate);
    previousEnd.setDate(previousEnd.getDate() - 1);
    previousEnd.setHours(23, 59, 59, 999);

    const previousRangeCalls = await Call.find({
      ...dateFilter,
      started_at: {
        $gte: previousStart,
        $lte: previousEnd
      }
    }).lean();

    const comparison = calculateComparison(rangeCalls, previousRangeCalls);

    // Format period name
    const formatDate = (date) => date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: startDate.getFullYear() !== endDate.getFullYear() ? 'numeric' : undefined
    });
    const periodName = `${formatDate(startDate)} - ${formatDate(endDate)}`;

    res.json({
      period: 'custom',
      date_range: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        period_name: periodName
      },
      ...stats,
      daily_breakdown: dailyBreakdown,
      comparison
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching custom range statistics',
      error: error.message
    });
  }
};

// Helper function to calculate period statistics
const calculatePeriodStats = (calls, period, startDate, endDate) => {
  const totalCalls = calls.length;
  const incomingCalls = calls.filter(call => call.direction === 'incoming');
  const outgoingCalls = calls.filter(call => call.direction === 'outgoing');
  const answeredCalls = calls.filter(call => call.answered_at).length;
  const missedCalls = calls.filter(call => !call.answered_at && call.ended_at).length;
  const busyCalls = calls.filter(call => call.disposition === 'busy').length;
  const failedCalls = calls.filter(call => call.disposition === 'failed' || call.disposition === 'congestion').length;

  // Helper function to calculate metrics for a specific call subset
  const calculateSubsetMetrics = (callSubset) => {
    const total = callSubset.length;
    const answered = callSubset.filter(call => call.answered_at).length;
    const missed = callSubset.filter(call => !call.answered_at && call.ended_at).length;
    const busy = callSubset.filter(call => call.disposition === 'busy').length;
    const failed = callSubset.filter(call => call.disposition === 'failed' || call.disposition === 'congestion').length;
    
    const answerRate = total > 0 ? (answered / total * 100) : 0;
    
    const answeredWithTimes = callSubset.filter(call => call.answered_at && call.ring_seconds);
    const avgRingTime = answeredWithTimes.length > 0 ? 
      answeredWithTimes.reduce((sum, call) => sum + call.ring_seconds, 0) / answeredWithTimes.length : 0;
      
    const callsWithTalkTime = callSubset.filter(call => call.talk_seconds);
    const avgTalkTime = callsWithTalkTime.length > 0 ?
      callsWithTalkTime.reduce((sum, call) => sum + call.talk_seconds, 0) / callsWithTalkTime.length : 0;
    
    const totalTalkTime = callSubset.reduce((sum, call) => sum + (call.talk_seconds || 0), 0);

    return {
      total,
      answered,
      missed,
      busy,
      failed,
      answer_rate: Math.round(answerRate * 100) / 100,
      avg_ring_time: Math.round(avgRingTime),
      avg_talk_time: Math.round(avgTalkTime),
      total_talk_time: Math.round(totalTalkTime)
    };
  };

  // Calculate separate metrics for incoming and outgoing calls
  const incomingMetrics = calculateSubsetMetrics(incomingCalls);
  const outgoingMetrics = calculateSubsetMetrics(outgoingCalls);

  // Calculate overall performance metrics
  const answerRate = totalCalls > 0 ? (answeredCalls / totalCalls * 100) : 0;
  
  const answeredCallsWithTimes = calls.filter(call => call.answered_at && call.ring_seconds);
  const avgRingTime = answeredCallsWithTimes.length > 0 ? 
    answeredCallsWithTimes.reduce((sum, call) => sum + call.ring_seconds, 0) / answeredCallsWithTimes.length : 0;
    
  const callsWithTalkTime = calls.filter(call => call.talk_seconds);
  const avgTalkTime = callsWithTalkTime.length > 0 ?
    callsWithTalkTime.reduce((sum, call) => sum + call.talk_seconds, 0) / callsWithTalkTime.length : 0;
  
  const totalTalkTime = calls.reduce((sum, call) => sum + (call.talk_seconds || 0), 0);

  // Find peak hour/day
  let peakHour = "N/A";
  let busiestDay = "N/A";

  if (period === 'today') {
    // Find peak hour for today
    const hourCounts = {};
    calls.forEach(call => {
      const hour = new Date(call.started_at).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    const maxHour = Object.keys(hourCounts).reduce((a, b) => hourCounts[a] > hourCounts[b] ? a : b, '0');
    peakHour = `${maxHour}:00-${parseInt(maxHour) + 1}:00`;
  } else {
    // Find busiest day for weekly/monthly
    const dayCounts = {};
    calls.forEach(call => {
      const day = new Date(call.started_at).toLocaleDateString('en-US', { weekday: 'long' });
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    });
    busiestDay = Object.keys(dayCounts).reduce((a, b) => dayCounts[a] > dayCounts[b] ? a : b, 'N/A');
  }

  return {
    totals: {
      total_calls: totalCalls,
      incoming_calls: incomingCalls.length,
      outgoing_calls: outgoingCalls.length,
      answered_calls: answeredCalls,
      missed_calls: missedCalls,
      busy_calls: busyCalls,
      failed_calls: failedCalls
    },
    incoming_metrics: incomingMetrics,
    outgoing_metrics: outgoingMetrics,
    performance_metrics: {
      answer_rate: Math.round(answerRate * 100) / 100,
      avg_ring_time: Math.round(avgRingTime),
      avg_talk_time: Math.round(avgTalkTime),
      total_talk_time: Math.round(totalTalkTime),
      peak_hour: peakHour,
      busiest_day: busiestDay
    }
  };
};

// Helper function to calculate comparison with previous period
const calculateComparison = (currentCalls, previousCalls) => {
  const currentTotal = currentCalls.length;
  const previousTotal = previousCalls.length;
  const currentAnswered = currentCalls.filter(call => call.answered_at).length;
  const previousAnswered = previousCalls.filter(call => call.answered_at).length;

  // Overall metrics
  const totalChange = currentTotal - previousTotal;
  const totalChangePercentage = previousTotal > 0 ? (totalChange / previousTotal * 100) : 0;

  const currentAnswerRate = currentTotal > 0 ? (currentAnswered / currentTotal * 100) : 0;
  const previousAnswerRate = previousTotal > 0 ? (previousAnswered / previousTotal * 100) : 0;
  const answerRateChange = currentAnswerRate - previousAnswerRate;

  // Incoming call metrics
  const currentIncoming = currentCalls.filter(call => call.direction === 'incoming');
  const previousIncoming = previousCalls.filter(call => call.direction === 'incoming');
  const incomingChange = currentIncoming.length - previousIncoming.length;
  const incomingChangePercentage = previousIncoming.length > 0 ? (incomingChange / previousIncoming.length * 100) : 0;

  // Outgoing call metrics
  const currentOutgoing = currentCalls.filter(call => call.direction === 'outgoing');
  const previousOutgoing = previousCalls.filter(call => call.direction === 'outgoing');
  const outgoingChange = currentOutgoing.length - previousOutgoing.length;
  const outgoingChangePercentage = previousOutgoing.length > 0 ? (outgoingChange / previousOutgoing.length * 100) : 0;

  return {
    total_calls_change: totalChange,
    total_calls_change_pct: Math.round(totalChangePercentage * 100) / 100,
    answer_rate_change: Math.round(answerRateChange * 100) / 100,
    incoming_calls_change: incomingChange,
    incoming_calls_change_pct: Math.round(incomingChangePercentage * 100) / 100,
    outgoing_calls_change: outgoingChange,
    outgoing_calls_change_pct: Math.round(outgoingChangePercentage * 100) / 100
  };
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