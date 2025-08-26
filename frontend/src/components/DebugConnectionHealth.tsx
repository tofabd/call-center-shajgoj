import React, { useEffect, useState } from 'react';
import { connectionHealthService } from '../services/connectionHealthService';

const DebugConnectionHealth: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    // Subscribe to health updates
    const unsubscribe = connectionHealthService.subscribe((healthUpdate) => {
      console.log('📡 Debug: Received health update:', healthUpdate);
      setHealth(healthUpdate);
    });

    // Get debug info
    const info = connectionHealthService.getDebugInfo();
    setDebugInfo(info);
    console.log('🔍 Debug: Service debug info:', info);

    // Force a health check
    connectionHealthService.forceHealthCheck();

    return unsubscribe;
  }, []);

  const forceCheck = () => {
    console.log('🔄 Debug: Forcing health check...');
    connectionHealthService.forceHealthCheck();
    
    // Update debug info
    setTimeout(() => {
      const info = connectionHealthService.getDebugInfo();
      setDebugInfo(info);
      console.log('🔍 Debug: Updated debug info:', info);
    }, 100);
  };

  return (
    <div className="fixed top-4 right-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-w-sm">
      <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">
        🔍 Connection Health Debug
      </h3>
      
      <div className="space-y-2 text-xs">
        <div>
          <strong>Status:</strong> {health?.status || 'Unknown'}
        </div>
        <div>
          <strong>Health:</strong> {health?.health || 'Unknown'}
        </div>
        <div>
          <strong>Connected:</strong> {health?.isConnected ? '✅ Yes' : '❌ No'}
        </div>
        <div>
          <strong>Monitoring:</strong> {debugInfo?.isMonitoring ? '✅ Yes' : '❌ No'}
        </div>
        <div>
          <strong>Subscribers:</strong> {debugInfo?.subscriberCount || 0}
        </div>
        <div>
          <strong>Socket Connected:</strong> {debugInfo?.socketConnected ? '✅ Yes' : '❌ No'}
        </div>
        {health?.lastHeartbeat && (
          <div>
            <strong>Last Heartbeat:</strong> {new Date(health.lastHeartbeat).toLocaleTimeString()}
          </div>
        )}
        {health?.timeSinceHeartbeat !== null && (
          <div>
            <strong>Time Since:</strong> {Math.round(health.timeSinceHeartbeat / 1000)}s
          </div>
        )}
      </div>
      
      <button
        onClick={forceCheck}
        className="mt-3 w-full px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
      >
        Force Health Check
      </button>
      
      <button
        onClick={() => {
          const info = connectionHealthService.getDebugInfo();
          setDebugInfo(info);
          console.log('🔍 Debug: Manual debug info update:', info);
        }}
        className="mt-2 w-full px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
      >
        Update Debug Info
      </button>
    </div>
  );
};

export default DebugConnectionHealth;
