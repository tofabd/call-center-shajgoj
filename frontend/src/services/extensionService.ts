import api from './api';

export interface Extension {
  id: string;
  extension: string;
  agent_name?: string;
  team_id?: number;
  team_name?: string;
  team?: string; // Backward compatibility - computed from team_name
  status_code: number;
  status_text?: string;
  availability_status: 'online' | 'offline' | 'unknown' | 'invalid';
  status_changed_at?: string; // New timestamp field
  device_state: string;
  is_active: boolean;
  department?: string; // Alias for team_name for backward compatibility
  created_at: string;
  updated_at: string;
  createdAt: string; // For backward compatibility
  updatedAt: string; // For backward compatibility
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
  extensions: number;
  duration_ms: number;
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
    
    // Status label mapping based on availability_status and device state
    const getStatusLabel = (availabilityStatus: string, deviceState: string, statusText?: string): string => {
      // Use status_text from backend if available
      if (statusText && statusText !== 'Unknown') {
        return statusText;
      }

      // Map availability_status to user-friendly labels
      if (availabilityStatus === 'online') {
        const deviceStateMap: Record<string, string> = {
          'NOT_INUSE': 'Available',
          'INUSE': 'On Call',
          'BUSY': 'Busy',
          'RINGING': 'Ringing',
          'RING*INUSE': 'Call Waiting',
          'RINGINUSE': 'Call Waiting',
          'ONHOLD': 'On Hold'
        };
        return deviceStateMap[deviceState] || 'Online';
      }

      const statusMap: Record<string, string> = {
        'online': 'Available',
        'offline': 'Offline',
        'unknown': 'Unknown',
        'invalid': 'Invalid'
      };

      return statusMap[availabilityStatus] || 'Unknown';
    };

    // Map backend response to frontend interface
    const mappedExtensions = extensions.map((ext: any) => ({
      ...ext,
      // Map new backend fields to frontend format
      team: ext.team_name || ext.department, // Use team_name from backend
      department: ext.team_name || ext.department, // Backward compatibility
      status_changed_at: ext.status_changed_at, // New timestamp field
      created_at: ext.created_at,
      updated_at: ext.updated_at,
      createdAt: ext.created_at, // Backward compatibility
      updatedAt: ext.updated_at, // Backward compatibility
      // Add human-readable status label
      statusLabel: getStatusLabel(
        ext.availability_status || 'unknown', 
        ext.device_state || 'UNKNOWN',
        ext.status_text
      )
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
