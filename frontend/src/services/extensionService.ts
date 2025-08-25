import api from './api';

export interface Extension {
  _id: string;
  id: string; // For backward compatibility, will map from _id
  extension: string;
  agent_name?: string;
  status: 'online' | 'offline' | 'unknown';
  is_active: boolean;
  last_seen?: string;
  context?: string;
  hint?: string;
  metadata?: Record<string, unknown>;
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
      updated_at: ext.updatedAt  // Map updatedAt to updated_at
    }));
    
    return mappedExtensions;
  },

  // Get extension statistics
  async getStats(): Promise<ExtensionStatsResponse> {
    const response = await api.get('/extensions/statistics');
    return response.data.data;
  },

  // Create new extension
  async createExtension(data: { extension: string; agent_name?: string }): Promise<Extension> {
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
  async updateExtension(id: string, data: { extension?: string; agent_name?: string; status?: string; is_active?: boolean }): Promise<Extension> {
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
  }
};
