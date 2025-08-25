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
  callFlow?: CallFlowStep[];
  extensionChanges?: ExtensionChange[];
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