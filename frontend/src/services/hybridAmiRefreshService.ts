import api from './api';

export interface HybridAmiRefreshResult {
  success: boolean;
  message: string;
  data: {
    extensionsChecked: number;
    lastQueryTime: string;
    statistics: {
      successfulQueries: number;
      failedQueries: number;
    };
  };
}

export interface ExtensionStatus {
  extension: string;
  status: 'online' | 'offline' | 'unknown';
  statusCode: string;
  statusText: string;
  error?: string;
}

/**
 * Hybrid AMI Refresh Service
 * Creates a separate AMI connection for manual refresh operations
 * This service is independent of the project's existing AMI connection
 */
export const hybridAmiRefreshService = {
  /**
   * Create a separate Hybrid AMI connection and refresh extension statuses
   * This bypasses the project's existing connection and creates a new one
   */
  async refreshWithSeparateConnection(): Promise<HybridAmiRefreshResult> {
    try {
      console.log('🚀 [HybridAmiRefreshService] Creating separate Hybrid AMI connection for refresh...');
      
      const response = await api.post('/extensions/hybrid-refresh', {
        useSeparateConnection: true,
        timestamp: Date.now()
      });
      
      console.log('✅ [HybridAmiRefreshService] Separate connection refresh completed:', response.data);
      return response.data.data;
      
    } catch (error) {
      console.error('❌ [HybridAmiRefreshService] Separate connection refresh failed:', error);
      throw error;
    }
  },

  /**
   * Get the status of the separate Hybrid AMI connection
   */
  async getSeparateConnectionStatus(): Promise<any> {
    try {
      const response = await api.get('/extensions/hybrid-refresh/status');
      return response.data.data;
    } catch (error) {
      console.error('❌ [HybridAmiRefreshService] Failed to get separate connection status:', error);
      throw error;
    }
  },

  /**
   * Close the separate Hybrid AMI connection
   */
  async closeSeparateConnection(): Promise<void> {
    try {
      await api.post('/extensions/hybrid-refresh/close');
      console.log('✅ [HybridAmiRefreshService] Separate connection closed');
    } catch (error) {
      console.error('❌ [HybridAmiRefreshService] Failed to close separate connection:', error);
      throw error;
    }
  }
};

export default hybridAmiRefreshService;
