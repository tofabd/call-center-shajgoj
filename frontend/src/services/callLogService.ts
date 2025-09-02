import api from '@services/api';



export interface CallLog {
  id: string;
  callerNumber: string;
  callerName: string | null;
  startTime: string;
  endTime?: string;
  status: string;
  duration?: number;
  direction?: 'incoming' | 'outgoing';
  agentExten?: string | null;
  otherParty?: string | null;
}

export interface CallFlowStep {
  uniqueid: string;
  channel: string | null;
  exten: string | null;
  context: string | null;
  channel_state: string | null;
  channel_state_desc: string | null;
  state: string | null;
  callerid_num: string | null;
  callerid_name: string | null;
  connected_line_num: string | null;
  connected_line_name: string | null;
  start_time: string | null;
  answer_at: string | null;
  hangup_at: string | null;
  hangup_cause: string | null;
  agent_exten_if_leg: string | null;
  other_party_if_leg: string | null;
  step_type: string;
  step_description: string;
}

export interface ExtensionChange {
  time: string | null;
  from_extension: string | null;
  to_extension: string;
  context: string | null;
  reason: string;
  channel: string | null;
}

export interface CallDetails {
  id: string;
  uniqueid: string;
  linkedid: string | null;
  channel: string | null;
  callerNumber: string | null;
  callerName: string | null;
  extension: string | null;
  context: string | null;
  channelState: string | null;
  channelStateDesc: string | null;
  connectedLineNum: string | null;
  connectedLineName: string | null;
  state: string | null;
  startTime: string;
  endTime: string | null;
  status: string;
  duration: number | null;
  callInstanceId: number | null;
  createdAt: string;
  updatedAt: string;
  direction?: 'incoming' | 'outgoing';
  agentExten?: string | null;
  otherParty?: string | null;
  callFlow?: CallFlowStep[];
  extensionChanges?: ExtensionChange[];
}

// Legacy CallStats interface (deprecated - use PeriodStats instead)
export interface CallStats {
  total_calls: number;
  incoming_calls: number;
  outgoing_calls: number;
  calls_by_status?: {
    completed?: number;
    in_progress?: number;
    ringing?: number;
    'no_answer'?: number;
    busy?: number;
    failed?: number;
    canceled?: number;
    rejected?: number;
    unknown?: number;
  };
  incoming_by_status?: {
    completed?: number;
    in_progress?: number;
    ringing?: number;
    'no_answer'?: number;
    busy?: number;
    failed?: number;
    canceled?: number;
    rejected?: number;
    unknown?: number;
  };
  outgoing_by_status?: {
    completed?: number;
    in_progress?: number;
    ringing?: number;
    'no_answer'?: number;
    busy?: number;
    failed?: number;
    canceled?: number;
    rejected?: number;
    unknown?: number;
  };
  summary?: {
    active_calls: number;
    completed_calls: number;
    total_handled_calls: number;
  };
  date: string;
}

// New enhanced PeriodStats interface
export type TimeRange = 'today' | 'weekly' | 'monthly' | 'custom';

export interface HourlyBreakdown {
  hour: number;              // 0-23
  call_count: number;
  answered: number;
  missed: number;
}

export interface DailyBreakdown {
  date: string;              // "2024-12-09"
  day_name: string;          // "Monday"
  call_count: number;
  answered: number;
  missed: number;
}

export interface PeriodStats {
  period: TimeRange;
  date_range: {
    start: string;
    end: string;
    period_name: string;     // "Today", "This Week", "December 2024"
  };
  totals: {
    total_calls: number;
    incoming_calls: number;
    outgoing_calls: number;
    answered_calls: number;
    missed_calls: number;
    busy_calls: number;
    failed_calls: number;
  };
  // Separate incoming call metrics
  incoming_metrics: {
    total: number;
    answered: number;
    missed: number;
    busy: number;
    failed: number;
    answer_rate: number;      // percentage
    avg_ring_time: number;    // seconds
    avg_talk_time: number;    // seconds
    total_talk_time: number;  // seconds
  };
  // Separate outgoing call metrics  
  outgoing_metrics: {
    total: number;
    answered: number;
    missed: number;
    busy: number;
    failed: number;
    answer_rate: number;      // percentage
    avg_ring_time: number;    // seconds
    avg_talk_time: number;    // seconds
    total_talk_time: number;  // seconds
  };
  performance_metrics: {
    answer_rate: number;        // percentage (overall)
    avg_ring_time: number;      // seconds (overall)
    avg_talk_time: number;      // seconds (overall)
    total_talk_time: number;    // seconds (overall)
    peak_hour: string;          // "14:00-15:00"
    busiest_day?: string;       // "Monday" (weekly/monthly only)
  };
  hourly_breakdown?: HourlyBreakdown[];   // Today only
  daily_breakdown?: DailyBreakdown[];     // Weekly/Monthly only
  comparison?: {               // vs previous period
    total_calls_change: number;    // +15 or -8
    total_calls_change_pct: number; // +12.5% or -5.2%
    answer_rate_change: number;     // +2.1% or -1.8%
    incoming_calls_change: number;  // +10 or -5
    incoming_calls_change_pct: number; // +8.5% or -3.2%
    outgoing_calls_change: number;  // +5 or -3
    outgoing_calls_change_pct: number; // +15.2% or -7.1%
  };
}

class CallLogService {
  async getCallLogs(): Promise<CallLog[]> {
    try {
      const response = await api.get<{
        success: boolean;
        data: CallLog[];
        pagination: any;
      }>('/calls');
      
      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error('API returned error');
      }
    } catch (error) {
      console.error('Error fetching calls:', error);
      throw error;
    }
  }

  // Legacy method (deprecated - use getTodayStats instead)
  async getTodayStats(): Promise<CallStats> {
    const response = await api.get<CallStats>('/calls/today-stats');
    return response.data;
  }

  // New enhanced statistics methods
  async getTodayStatsEnhanced(): Promise<PeriodStats> {
    const response = await api.get<PeriodStats>('/calls/today-stats');
    return response.data;
  }

  async getWeeklyStats(): Promise<PeriodStats> {
    const response = await api.get<PeriodStats>('/calls/weekly-stats');  
    return response.data;
  }

  async getMonthlyStats(): Promise<PeriodStats> {
    const response = await api.get<PeriodStats>('/calls/monthly-stats');
    return response.data;
  }

  async getPeriodStats(startDate: string, endDate: string): Promise<PeriodStats> {
    const response = await api.get<PeriodStats>(`/calls/custom-range-stats?start_date=${startDate}&end_date=${endDate}`);
    return response.data;
  }

  // Method to get stats based on time range
  async getStatsByRange(range: TimeRange, customRange?: { start: Date; end: Date }): Promise<PeriodStats> {
    switch (range) {
      case 'today':
        return this.getTodayStatsEnhanced();
      case 'weekly':
        return this.getWeeklyStats();
      case 'monthly':
        return this.getMonthlyStats();
      case 'custom':
        if (!customRange) {
          throw new Error('Custom range requires start and end dates');
        }
        return this.getPeriodStats(
          customRange.start.toISOString(),
          customRange.end.toISOString()
        );
      default:
        throw new Error(`Invalid time range: ${range}`);
    }
  }

  async getCallDetails(id: string): Promise<CallDetails> {
    try {
      const response = await api.get<{
        success: boolean;
        data: CallDetails;
      }>(`/calls/${id}/details`);
      
      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error('API returned error');
      }
    } catch (error) {
      console.error('Error fetching call details:', error);
      throw error;
    }
  }

 
}

export const callLogService = new CallLogService();