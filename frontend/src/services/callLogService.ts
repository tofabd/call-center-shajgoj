import api from '@services/api';



export interface CallLog {
  id: number;
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

export interface CallDetails {
  id: number;
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
}

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

class CallLogService {
  async getCallLogs(): Promise<CallLog[]> {
    const response = await api.get<CallLog[]>('/calls');
    return response.data;
  }

  async getTodayStats(): Promise<CallStats> {
    const response = await api.get<CallStats>('/calls/today-stats');
    return response.data;
  }

  async getCallDetails(id: number): Promise<CallDetails> {
    const response = await api.get<CallDetails>(`/calls/${id}/details`);
    return response.data;
  }

 
}

export const callLogService = new CallLogService();