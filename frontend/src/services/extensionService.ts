import api from './api';

export interface Extension {
  _id: string;
  id: string; // For backward compatibility, will map from _id
  extension: string;
  agent_name?: string;
  status_code: number;
  device_state: string;
  status: 'online' | 'offline' | 'unknown';
  last_status_change?: string;
  last_seen?: string;
  is_active: boolean;
  department?: string;
  createdAt: string;
  updatedAt: string;
  created_at: string; // For backward compatibility
  updated_at: string; // For backward compatibility
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
}

export const extensionService = {
  // Get all extensions
  async getExtensions(): Promise<Extension[]> {
    const response = await api.get('/extensions');
    const extensions = response.data.data;
    
    // Map MongoDB response to frontend interface for backward compatibility
    const mappedExtensions = extensions.map((ext: Record<string, unknown>) => ({
      ...ext,
      id: ext._id, // Map _id to id for backward compatibility
      created_at: ext.createdAt, // Map createdAt to created_at
      updated_at: ext.updatedAt, // Map updatedAt to updated_at
      // Ensure new fields have default values if missing
      status_code: ext.status_code || 0,
      device_state: ext.device_state || 'NOT_INUSE',
      last_status_change: ext.last_status_change || null,
      department: ext.department || null
    }));
    
    return mappedExtensions;
  },

  // Get extension statistics
  async getStats(): Promise<ExtensionStatsResponse> {
    const response = await api.get('/extensions/statistics');
    return response.data.data;
  },

  // Create new extension
  async createExtension(data: { extension: string; agent_name?: string; department?: string }): Promise<Extension> {
    const response = await api.post('/extensions', data);
    const ext = response.data.data;
    return {
      ...ext,
      id: ext._id,
      created_at: ext.createdAt,
      updated_at: ext.updatedAt
    };
  },

  // Update extension
  async updateExtension(id: string, data: { extension?: string; agent_name?: string; department?: string; is_active?: boolean }): Promise<Extension> {
    const response = await api.put(`/extensions/${id}`, data);
    const ext = response.data.data;
    return {
      ...ext,
      id: ext._id,
      created_at: ext.createdAt,
      updated_at: ext.updatedAt
    };
  },

  // Delete extension
  async deleteExtension(id: string): Promise<void> {
    await api.delete(`/extensions/${id}`);
  },

  // Sync extensions from Asterisk (not available in MongoDB API)
  async syncExtensions(): Promise<{ synced_count: number; extensions: Extension[] }> {
    // This feature is not available in the MongoDB API
    // Return empty result to maintain compatibility
    console.warn('Sync extensions feature is not available in MongoDB API');
    return { synced_count: 0, extensions: [] };
  },

  // Update extension status
  async updateStatus(extension: string, status: string): Promise<void> {
    await api.put('/extensions/status', { extension, status });
  },

  // Update extension active status
  async updateActiveStatus(id: string, is_active: boolean): Promise<Extension> {
    const response = await api.put(`/extensions/${id}`, { is_active });
    const ext = response.data.data;
    return {
      ...ext,
      id: ext._id,
      created_at: ext.createdAt,
      updated_at: ext.updatedAt
    };
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
  }
};
