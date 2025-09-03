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
  total_calls: number;
  incoming_calls: number;
  outgoing_calls: number;
  calls_by_status: Record<string, number>;
  incoming_by_status: Record<string, number>;
  outgoing_by_status: Record<string, number>;
  date: string;
  summary: {
    active_calls: number;
    completed_calls: number;
    total_handled_calls: number;
  };
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

  // Get call by ID with details from Laravel
  async getCallById(id: string): Promise<any> {
    const response = await api.get(`/calls/${id}/details`);
    return response.data;
  }
};