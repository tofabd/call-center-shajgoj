import socketService from './socketService';

export interface ConnectionHealth {
  status: 'connected' | 'disconnected' | 'reconnecting' | 'checking';
  health: 'good' | 'poor' | 'stale';
  lastHeartbeat: Date | null;
  timeSinceHeartbeat: number | null;
  isConnected: boolean;
}

export type ConnectionHealthCallback = (health: ConnectionHealth) => void;

export class ConnectionHealthService {
  private static instance: ConnectionHealthService;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private subscribers: Set<ConnectionHealthCallback> = new Set();
  private currentHealth: ConnectionHealth = {
    status: 'checking',
    health: 'poor',
    lastHeartbeat: null,
    timeSinceHeartbeat: null,
    isConnected: false
  };
  private isMonitoring = false;

  private constructor() {
    // Private constructor for singleton pattern
    // Auto-start monitoring when service is created
    this.startHealthMonitoring();
  }

  static getInstance(): ConnectionHealthService {
    if (!this.instance) {
      this.instance = new ConnectionHealthService();
    }
    return this.instance;
  }

  /**
   * Start health monitoring for the entire application
   * Should be called once in the main app component
   */
  start(): void {
    this.startHealthMonitoring();
  }

  /**
   * Start health monitoring for the entire application
   * Should be called once in the main app component
   */
  startHealthMonitoring(): void {
    if (this.isMonitoring) {
      console.log('🔄 Connection health monitoring already started');
      return;
    }

    console.log('🔄 Starting unified connection health monitoring...');
    this.isMonitoring = true;

    // Initial health check
    this.checkHealth();

    // Set up periodic health checks every 5 seconds
    this.healthCheckInterval = setInterval(() => {
      this.checkHealth();
    }, 5000);

    console.log('✅ Unified connection health monitoring started');
  }

  /**
   * Stop health monitoring
   * Should be called when the app is shutting down
   */
  stop(): void {
    this.stopHealthMonitoring();
  }

  /**
   * Stop health monitoring
   * Should be called when the app is shutting down
   */
  stopHealthMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    console.log('🔄 Stopping unified connection health monitoring...');
    this.isMonitoring = false;

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    console.log('✅ Unified connection health monitoring stopped');
  }

  /**
   * Subscribe to connection health updates
   * Returns unsubscribe function
   */
  subscribe(callback: ConnectionHealthCallback): () => void {
    this.subscribers.add(callback);
    
    // Immediately send current health to new subscriber
    callback(this.currentHealth);
    
    console.log(`📡 Component subscribed to connection health. Total subscribers: ${this.subscribers.size}`);
    
    return () => {
      this.subscribers.delete(callback);
      console.log(`📡 Component unsubscribed from connection health. Total subscribers: ${this.subscribers.size}`);
    };
  }

  /**
   * Get current connection health without subscribing
   */
  getCurrentHealth(): ConnectionHealth {
    return { ...this.currentHealth };
  }

  /**
   * Force a health check and notify all subscribers
   */
  forceHealthCheck(): void {
    console.log('🔄 Forcing connection health check...');
    this.checkHealth();
  }

  /**
   * Check connection health and update all subscribers
   */
  private checkHealth(): void {
    const previousHealth = { ...this.currentHealth };
    
    // For Laravel compatibility, treat socket as disabled/disconnected
    const isSocketConnected = socketService.isConnected();
    
    console.log('🔍 Checking connection health...', {
      socketConnected: isSocketConnected,
      lastHeartbeat: socketService.getLastHeartbeat()
    });
    
    if (isSocketConnected) {
      this.currentHealth.status = 'connected';
      this.currentHealth.isConnected = true;
      
      const lastHeartbeat = socketService.getLastHeartbeat();
      this.currentHealth.lastHeartbeat = lastHeartbeat;
      
      if (lastHeartbeat) {
        const timeSinceHeartbeat = new Date().getTime() - lastHeartbeat.getTime();
        this.currentHealth.timeSinceHeartbeat = timeSinceHeartbeat;
        
        if (timeSinceHeartbeat < 15000) { // Less than 15 seconds
          this.currentHealth.health = 'good';
        } else if (timeSinceHeartbeat < 30000) { // Less than 30 seconds
          this.currentHealth.health = 'poor';
        } else { // More than 30 seconds
          this.currentHealth.health = 'stale';
          // Attempt reconnection when stale (if not disabled)
          console.log('🔄 Connection stale, attempting reconnection...');
          socketService.reconnect();
        }
      } else {
        this.currentHealth.health = 'poor';
        this.currentHealth.timeSinceHeartbeat = null;
      }
    } else {
      // Socket is disconnected or disabled
      this.currentHealth.status = 'disconnected';
      this.currentHealth.health = 'poor';
      this.currentHealth.isConnected = false;
      this.currentHealth.lastHeartbeat = null;
      this.currentHealth.timeSinceHeartbeat = null;
      
      // Only attempt reconnection if socket is not disabled
      // For Laravel mode, we skip reconnection attempts
      console.log('🔄 Socket disconnected (Laravel mode - real-time features disabled)');
    }

    // Check if health changed
    const healthChanged = JSON.stringify(previousHealth) !== JSON.stringify(this.currentHealth);
    
    if (healthChanged) {
      console.log('🔄 Connection health changed:', {
        from: previousHealth,
        to: this.currentHealth
      });
      
      // Notify all subscribers
      this.notifyAllSubscribers();
    }
  }

  /**
   * Notify all subscribers of current health status
   */
  private notifyAllSubscribers(): void {
    const health = { ...this.currentHealth };
    
    this.subscribers.forEach((callback, index) => {
      try {
        callback(health);
      } catch (error) {
        console.error(`❌ Error in connection health subscriber ${index}:`, error);
        // Remove problematic subscriber
        this.subscribers.delete(callback);
      }
    });
  }

  /**
   * Get connection status summary for debugging
   */
  getDebugInfo(): {
    isMonitoring: boolean;
    subscriberCount: number;
    currentHealth: ConnectionHealth;
    socketConnected: boolean;
  } {
    return {
      isMonitoring: this.isMonitoring,
      subscriberCount: this.subscribers.size,
      currentHealth: { ...this.currentHealth },
      socketConnected: socketService.isConnected()
    };
  }
}

// Export singleton instance
export const connectionHealthService = ConnectionHealthService.getInstance();
