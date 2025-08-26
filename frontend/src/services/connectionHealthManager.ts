import { connectionHealthService } from './connectionHealthService';

/**
 * Connection Health Manager
 * 
 * This manager is responsible for starting and stopping the unified connection health service
 * for the entire application. It should be initialized once when the app starts.
 */
export class ConnectionHealthManager {
  private static isInitialized = false;

  /**
   * Initialize the connection health monitoring for the entire application
   * Call this once in your main App component or layout
   */
  static initialize(): void {
    if (this.isInitialized) {
      console.log('🔄 Connection health manager already initialized');
      return;
    }

    console.log('🚀 Initializing unified connection health monitoring...');
    
    try {
      // Start the unified connection health service
      connectionHealthService.startHealthMonitoring();
      
      this.isInitialized = true;
      console.log('✅ Connection health manager initialized successfully');
      
      // Log initial debug info
      const debugInfo = connectionHealthService.getDebugInfo();
      console.log('📊 Initial connection health debug info:', debugInfo);
      
    } catch (error) {
      console.error('❌ Failed to initialize connection health manager:', error);
    }
  }

  /**
   * Clean up connection health monitoring
   * Call this when the app is shutting down
   */
  static cleanup(): void {
    if (!this.isInitialized) {
      return;
    }

    console.log('🧹 Cleaning up connection health manager...');
    
    try {
      connectionHealthService.stopHealthMonitoring();
      this.isInitialized = false;
      console.log('✅ Connection health manager cleaned up successfully');
    } catch (error) {
      console.error('❌ Error cleaning up connection health manager:', error);
    }
  }

  /**
   * Get current connection health status
   */
  static getCurrentHealth() {
    return connectionHealthService.getCurrentHealth();
  }

  /**
   * Force a connection health check
   */
  static forceHealthCheck(): void {
    connectionHealthService.forceHealthCheck();
  }

  /**
   * Get debug information about the connection health system
   */
  static getDebugInfo() {
    return connectionHealthService.getDebugInfo();
  }

  /**
   * Check if the manager is initialized
   */
  static isManagerInitialized(): boolean {
    return this.isInitialized;
  }
}

// Export singleton instance
export const connectionHealthManager = ConnectionHealthManager;
