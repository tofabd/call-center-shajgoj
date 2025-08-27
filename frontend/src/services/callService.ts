import api from './api';

export interface LiveCall {
  _id: string;
  id: string; // For backward compatibility
  linkedid: string;
  direction?: 'incoming' | 'outgoing';
  other_party?: string;
  agent_exten?: string;
  started_at: string;
  answered_at?: string;
  ended_at?: string;
  ring_seconds?: number;
  talk_seconds?: number;
  caller_number?: string;
  caller_name?: string;
  dial_status?: string;
  disposition?: string;
  hangup_cause?: string;
  duration?: number; // Virtual field from API
  createdAt: string;
  updatedAt: string;
}

export interface CallStatistics {
  summary: {
    totalCalls: number;
    answeredCalls: number;
    missedCalls: number;
    answerRate: number;
  };
  byDirection: {
    incoming: number;
    outgoing: number;
  };
  byStatus: Record<string, number>;
  averages: {
    ringTime: number;
    talkTime: number;
    totalTalkTime: number;
  };
  dateRange: {
    start: string;
    end: string;
  };
}

export const callService = {
  // Get all calls with pagination and filtering
  async getCalls(params?: {
    page?: number;
    limit?: number;
    status?: string;
    direction?: string;
    agent_exten?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
  }): Promise<{ data: LiveCall[]; pagination: any }> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) queryParams.append(key, value.toString());
      });
    }

    const response = await api.get(`/calls?${queryParams.toString()}`);
    const calls = response.data.data;
    
    // Map MongoDB response to frontend interface
    const mappedCalls = calls.map((call: any) => ({
      ...call,
      id: call._id, // Map _id to id for backward compatibility
    }));

    return {
      data: mappedCalls,
      pagination: response.data.pagination
    };
  },

  // Get live/active calls
  async getLiveCalls(): Promise<LiveCall[]> {
    const response = await api.get('/calls/live');
    const calls = response.data.data;
    
    // Map MongoDB response to frontend interface
    return calls.map((call: any) => ({
      ...call,
      id: call._id, // Map _id to id for backward compatibility
      callerNumber: call.caller_number, // Map for LiveCalls component compatibility
      callerName: call.caller_name,
      startTime: call.started_at,
      agentExten: call.agent_exten,
      otherParty: call.other_party
    }));
  },

  // Get call statistics
  async getCallStatistics(params?: {
    start_date?: string;
    end_date?: string;
    agent_exten?: string;
  }): Promise<CallStatistics> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) queryParams.append(key, value.toString());
      });
    }

    const response = await api.get(`/calls/statistics?${queryParams.toString()}`);
    return response.data.data;
  },

  // Get call by ID with details
  async getCallById(id: string): Promise<{
    call: LiveCall;
    callLegs: any[];
    bridgeSegments: any[];
  }> {
    const response = await api.get(`/calls/${id}`);
    const data = response.data.data;
    
    return {
      call: {
        ...data.call,
        id: data.call._id,
        callerNumber: data.call.caller_number,
        callerName: data.call.caller_name,
        startTime: data.call.started_at,
        agentExten: data.call.agent_exten,
        otherParty: data.call.other_party
      },
      callLegs: data.callLegs,
      bridgeSegments: data.bridgeSegments
    };
  }
};