import api from './api';

export interface Extension {
  id: number;
  extension: string;
  agent_name?: string;
  status: 'online' | 'offline' | 'unknown';
  is_active: boolean;
  last_seen?: string;
  created_at: string;
  updated_at: string;
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

export const extensionService = {
  // Get all extensions
  async getExtensions(): Promise<Extension[]> {
    const response = await api.get('/extensions');
    return response.data.data;
  },

  // Get extension statistics
  async getStats(): Promise<ExtensionStatsResponse> {
    const response = await api.get('/extensions/stats');
    return response.data.data;
  },

  // Create new extension
  async createExtension(data: { extension: string; agent_name?: string }): Promise<Extension> {
    const response = await api.post('/extensions', data);
    return response.data.data;
  },

  // Update extension
  async updateExtension(id: number, data: { extension?: string; agent_name?: string; status?: string; is_active?: boolean }): Promise<Extension> {
    const response = await api.put(`/extensions/${id}`, data);
    return response.data.data;
  },

  // Delete extension
  async deleteExtension(id: number): Promise<void> {
    await api.delete(`/extensions/${id}`);
  },

  // Sync extensions from Asterisk
  async syncExtensions(): Promise<{ synced_count: number; extensions: Extension[] }> {
    const response = await api.post('/extensions/sync');
    return response.data.data;
  },

  // Update extension status
  async updateStatus(extension: string, status: string): Promise<void> {
    await api.post('/extensions/status', { extension, status });
  },

  // Update extension active status
  async updateActiveStatus(id: number, is_active: boolean): Promise<Extension> {
    const response = await api.put(`/extensions/${id}`, { is_active });
    return response.data.data;
  }
};
