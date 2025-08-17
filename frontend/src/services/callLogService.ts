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
  calls_by_status: Record<string, number>;
  date: string;
}

class CallLogService {
  async getCallLogs(): Promise<CallLog[]> {
    const response = await api.get<CallLog[]>('/call-logs');
    return response.data;
  }

  async getTodayStats(): Promise<CallStats> {
    const response = await api.get<CallStats>('/call-logs/today-stats');
    return response.data;
  }

  async getCallDetails(id: number): Promise<CallDetails> {
    const response = await api.get<CallDetails>(`/call-logs/${id}/details`);
    return response.data;
  }

 
}

export const callLogService = new CallLogService();