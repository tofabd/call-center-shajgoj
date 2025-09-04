import api from './api';

export interface Extension {
  id: string;
  extension: string;
  agent_name?: string;
  team?: string;
  status_code: number;
  device_state: string;
  status: 'online' | 'offline' | 'unknown';
  last_status_change?: string;
  last_seen?: string;
  is_active: boolean;
  department?: string; // Alias for team for backward compatibility
  createdAt: string;
  updatedAt: string;
  created_at: string; // For backward compatibility
  updated_at: string; // For backward compatibility
  statusLabel?: string; // Human-readable status label
}

export interface ExtensionStats {
  online_agents: number;
  total_calls_today: number;
  avg_call_duration: string;
  success_rate: number;
  total_extensions: number;
}

export interface TopAgent {
  name: string;
  extension: string;
  calls: number;
  duration: string;
  success: string;
}

export interface ExtensionStatsResponse {
  stats: ExtensionStats;
  top_agents: TopAgent[];
}

export interface QueryServiceStatus {
  connected: boolean;
  queryInterval: number;
  lastQueryTime?: string;
  extensionsMonitored: number;
  statistics: {
    successfulQueries: number;
    failedQueries: number;
  };
  isQuerying: boolean;
}

export interface RefreshResult {
  success: boolean;
  message: string;
  lastQueryTime: string;
  extensionsChecked: number;
  statistics: {
    successfulQueries: number;
    failedQueries: number;
  };
  jsonFile?: {
    filename: string;
    fileSize: number;
    message: string;
  };
}

export interface ExtensionCallStats {
  extension: string;
  agentName: string;
  date: string;
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
  recentCalls: Array<{
    id: string;
    linkedid: string;
    direction?: 'incoming' | 'outgoing';
    other_party?: string;
    started_at: string;
    answered_at?: string;
    ended_at?: string;
    ring_seconds?: number;
    talk_seconds?: number;
    caller_number?: string;
    caller_name?: string;
    disposition?: string;
    status: string;
  }>;
}

export const extensionService = {
  // Get all extensions
  async getExtensions(): Promise<Extension[]> {
    const response = await api.get('/extensions');
    const extensions = response.data.data;
    
    // Status label mapping based on device state
    const getStatusLabel = (deviceState: string, statusCode: number): string => {
      const deviceStateMap: Record<string, string> = {
        'NOT_INUSE': 'Free',
        'INUSE': 'On Call',
        'BUSY': 'Busy',
        'UNAVAILABLE': 'Offline',
        'INVALID': 'Offline',
        'RINGING': 'Ringing',
        'RING*INUSE': 'Call Waiting',
        'ONHOLD': 'On Hold',
        'UNKNOWN': 'Unknown'
      };

      // Use device state if available
      if (deviceState && deviceStateMap[deviceState]) {
        return deviceStateMap[deviceState];
      }

      // Fallback to status code mapping
      const statusCodeMap: Record<number, string> = {
        0: 'Free',
        1: 'On Call',
        2: 'Busy',
        3: 'Offline',
        4: 'Ringing',
        5: 'Call Waiting',
        6: 'On Hold',
        7: 'On Call + On Hold',
        8: 'Ringing + On Hold'
      };

      return statusCodeMap[statusCode] || 'Unknown';
    };

    // Map MongoDB response to frontend interface
    const mappedExtensions = extensions.map((ext: Record<string, unknown>) => ({
      ...ext,
      // Ensure new fields have proper default values
      status_code: ext.status_code ?? 0,
      device_state: ext.device_state ?? 'NOT_INUSE',
      last_status_change: ext.last_status_change ?? null,
      last_seen: ext.last_seen ?? null,
      team: ext.team ?? null,
      department: ext.department ?? ext.team ?? null, // Support both fields
      created_at: ext.created_at || ext.createdAt, // Map createdAt to created_at
      updated_at: ext.updated_at || ext.updatedAt, // Map updatedAt to updated_at
      // Add human-readable status label
      statusLabel: getStatusLabel(ext.device_state as string ?? 'NOT_INUSE', ext.status_code as number ?? 0)
    }));
    
    return mappedExtensions;
  },

  // Get extension statistics
  async getStats(): Promise<ExtensionStatsResponse> {
    const response = await api.get('/extensions/statistics');
    return response.data.data;
  },

  // Create new extension
  async createExtension(data: { extension: string; agent_name?: string; department?: string; team?: string }): Promise<Extension> {
    // Support both department and team fields - prefer team if provided
    const requestData = {
      extension: data.extension,
      agent_name: data.agent_name,
      team: data.team || data.department
    };
    
    const response = await api.post('/extensions', requestData);
    return response.data.data;
  },

  // Update extension
  async updateExtension(id: string, data: { extension?: string; agent_name?: string; department?: string; team?: string; is_active?: boolean }): Promise<Extension> {
    // Support both department and team fields - prefer team if provided
    const requestData = {
      ...data,
      team: data.team || data.department
    };
    
    // Remove department from request data to avoid sending both
    delete requestData.department;
    
    const response = await api.put(`/extensions/${id}`, requestData);
    return response.data.data;
  },

  // Delete extension
  async deleteExtension(id: string): Promise<void> {
    await api.delete(`/extensions/${id}`);
  },

  // Sync extensions from Asterisk - Uses the same functionality as refresh
  async syncExtensions(): Promise<{ synced_count: number; extensions: Extension[] }> {
    console.log('🔄 Syncing extensions from Asterisk using refresh functionality...');
    
    // Use the working refresh functionality that queries AMI
    const refreshResult = await this.refreshStatus();
    
    // Return sync-compatible response format
    return {
      synced_count: refreshResult.extensionsChecked || 0,
      extensions: [] // Extensions are updated in database, will be fetched separately
    };
  },

  // Update extension status
  async updateStatus(extension: string, status: string): Promise<void> {
    await api.put('/extensions/status', { extension, status });
  },

  // Update extension active status
  async updateActiveStatus(id: string, is_active: boolean): Promise<Extension> {
    const response = await api.put(`/extensions/${id}`, { is_active });
    return response.data.data;
  },

  // Manual refresh extension status from AMI
  async refreshStatus(): Promise<RefreshResult> {
    const response = await api.post('/extensions/refresh');
    return response.data.data;
  },

  // Get extension state list with detailed status information
  async getExtensionStateList(): Promise<{ extensions: Array<{ extension: string; status: number; statusText: string; hint: string; context: string }> }> {
    const response = await api.get('/extensions/extension-state-list');
    return response.data.data;
  },

  // Get AMI Query Service status
  async getQueryServiceStatus(): Promise<QueryServiceStatus> {
    const response = await api.get('/extensions/query-service/status');
    return response.data.data;
  },

  // Get extension call statistics for today
  async getExtensionCallStatistics(extensionId: string): Promise<ExtensionCallStats> {
    const response = await api.get(`/extensions/${extensionId}/call-statistics`);
    return response.data.data;
  },

  // List available AMI response JSON files
  async getAmiResponseFiles(): Promise<{ files: Array<{ filename: string; fileSize: number; createdAt: string; modifiedAt: string }>; totalFiles: number }> {
    const response = await api.get('/extensions/ami-responses');
    return response.data.data;
  },

  // Download specific AMI response JSON file
  async downloadAmiResponseFile(filename: string): Promise<Blob> {
    const response = await api.get(`/extensions/ami-responses/${filename}`, {
      responseType: 'blob'
    });
    return response.data;
  }
};
