import api from './api';

export interface LiveCall {
  id: string;
  linkedid?: string;
  direction?: 'incoming' | 'outgoing';
  other_party?: string;
  agent_exten?: string;
  started_at: string;
  answered_at?: string;
  ended_at?: string;
  caller_number?: string;
  caller_name?: string;
  duration?: number;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  // Legacy fields for compatibility
  _id?: string;
}

export interface CallStatistics {
  period?: {
    type: string;
    date?: string;
    start_date?: string;
    end_date?: string;
    label: string;
  };
  total_calls: number;
  incoming_calls: number;
  outgoing_calls: number;
  calls_by_status: Record<string, number>;
  incoming_by_status: Record<string, number>;
  outgoing_by_status: Record<string, number>;
  date?: string;
  metrics: {
    active_calls: number;
    completed_calls: number;
    answered_calls: number;
    answer_rate: number;
    average_handle_time: number;
  };
  summary?: {
    active_calls: number;
    completed_calls: number;
    total_handled_calls: number;
  };
}

export interface HourlyTrend {
  hour: number;
  hour_label: string;
  total_calls: number;
  incoming_calls: number;
  outgoing_calls: number;
  completed_calls: number;
}

export interface HourlyTrendData {
  date: string;
  date_label: string;
  hourly_data: HourlyTrend[];
}

export interface AgentStat {
  agent_extension: string;
  total_calls: number;
  answered_calls: number;
  completed_calls: number;
  answer_rate: number;
  average_handle_time: number;
  incoming_calls: number;
  outgoing_calls: number;
}

export interface AgentStatsResponse {
  period: string;
  period_label: string;
  start_date: string;
  end_date: string;
  agents: AgentStat[];
}

export interface ComparisonStats {
  period: string;
  current: CallStatistics;
  previous: CallStatistics;
  changes: {
    total_calls: number;
    incoming_calls: number;
    outgoing_calls: number;
    answer_rate: number;
    completed_calls: number;
  };
}

export interface ExtensionStatistics {
  extension: string;
  period: {
    type: string;
    date?: string;
    start_date: string;
    end_date: string;
    label: string;
  };
  summary: {
    total_calls: number;
    answered_calls: number;
    missed_calls: number;
    answer_rate: number;
  };
  direction_breakdown: {
    incoming: number;
    outgoing: number;
  };
  status_breakdown: Record<string, number>;
  incoming_by_status: Record<string, number>;
  outgoing_by_status: Record<string, number>;
  performance: {
    average_ring_time: number;
    average_talk_time: number;
    total_talk_time: number;
  };
  recent_calls: Array<{
    id: string;
    direction: string;
    other_party: string;
    started_at: string;
    answered_at?: string;
    ended_at?: string;
    duration: number;
    status: string;
  }>;
}

export const callService = {
  // Get all calls from Laravel
  async getCalls(): Promise<LiveCall[]> {
    const response = await api.get('/calls');
    // Laravel returns array directly, not wrapped in data
    const calls = Array.isArray(response.data) ? response.data : [];
    
    return calls.map((call: any) => ({
      id: call.id.toString(),
      _id: call.id.toString(), // For legacy compatibility
      linkedid: call.linkedid || '',
      direction: call.direction,
      other_party: call.otherParty,
      agent_exten: call.agentExten,
      started_at: call.startTime,
      answered_at: call.answered_at,
      ended_at: call.endTime,
      caller_number: call.callerNumber,
      caller_name: call.callerName,
      duration: call.duration,
      status: call.status,
      createdAt: call.created_at,
      updatedAt: call.updated_at
    }));
  },

  // Get live/active calls from Laravel
  async getLiveCalls(): Promise<LiveCall[]> {
    const response = await api.get('/calls/live');
    // Laravel returns array directly
    const calls = Array.isArray(response.data) ? response.data : [];
    
    return calls.map((call: any) => ({
      id: call.id.toString(),
      _id: call.id.toString(), // For legacy compatibility
      linkedid: call.linkedid || '',
      direction: call.direction,
      other_party: call.other_party,
      agent_exten: call.agent_exten,
      started_at: call.started_at,
      answered_at: call.answered_at,
      ended_at: call.ended_at,
      caller_number: call.caller_number,
      caller_name: call.caller_name,
      duration: call.duration,
      status: call.status,
      createdAt: call.createdAt,
      updatedAt: call.updatedAt
    }));
  },

  // Get today's call statistics from Laravel
  async getCallStatistics(): Promise<CallStatistics> {
    const response = await api.get('/calls/today-stats');
    return response.data;
  },

  // Enhanced statistics methods
  async getTodayStats(): Promise<CallStatistics> {
    const response = await api.get('/calls/statistics/today');
    return response.data;
  },

  async getWeekStats(): Promise<CallStatistics> {
    const response = await api.get('/calls/statistics/week');
    return response.data;
  },

  async getLastWeekStats(): Promise<CallStatistics> {
    const response = await api.get('/calls/statistics/last-week');
    return response.data;
  },

  async getMonthStats(): Promise<CallStatistics> {
    const response = await api.get('/calls/statistics/month');
    return response.data;
  },

  async getDateRangeStats(startDate: string, endDate: string): Promise<CallStatistics> {
    const response = await api.get('/calls/statistics/date-range', {
      params: { start_date: startDate, end_date: endDate }
    });
    return response.data;
  },

  async getHourlyTrends(date?: string): Promise<HourlyTrendData> {
    const response = await api.get('/calls/statistics/hourly-trends', {
      params: date ? { date } : {}
    });
    return response.data;
  },

  async getAgentStats(period: 'today' | 'week' | 'month' = 'today'): Promise<AgentStatsResponse> {
    const response = await api.get('/calls/statistics/agents', {
      params: { period }
    });
    return response.data;
  },

  async getComparisonStats(period: 'week' | 'month' = 'week'): Promise<ComparisonStats> {
    const response = await api.get('/calls/statistics/comparison', {
      params: { period }
    });
    return response.data;
  },

  async getExtensionStats(extension: string, date: 'today' | 'week' | 'month' = 'today'): Promise<ExtensionStatistics> {
    const response = await api.get(`/calls/statistics/extension/${extension}`, {
      params: { date }
    });
    return response.data;
  },

  // Get call by ID with details from Laravel
  async getCallById(id: string): Promise<any> {
    const response = await api.get(`/calls/${id}/details`);
    return response.data;
  }
};