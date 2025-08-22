import React, { useState, useEffect, useCallback } from 'react';
import { extensionService } from '../../services/extensionService';
import { extensionRealtimeService } from '../../services/extensionRealtimeService';
import type { Extension } from '../../services/extensionService';
import type { ExtensionStatusUpdate } from '../../services/extensionRealtimeService';

const AgentsStatus: React.FC = () => {
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'disconnected' | 'unavailable'>('unavailable');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    loadExtensions();
    
    // Subscribe to real-time extension status updates
    const unsubscribe = extensionRealtimeService.subscribeToAll((update: ExtensionStatusUpdate) => {
      setExtensions(prevExtensions => 
        prevExtensions.map(ext => 
          ext.id === update.id 
            ? { ...ext, ...update }
            : ext
        )
      );
      setLastUpdate(new Date());
    });
    
    // Fallback polling every 60 seconds (reduced frequency since we have real-time)
    const interval = setInterval(loadExtensions, 60000);
    
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  // Monitor real-time connection status
  useEffect(() => {
    const updateRealtimeStatus = () => {
      setRealtimeStatus(extensionRealtimeService.getConnectionStatus());
    };

    // Update immediately
    updateRealtimeStatus();

    // Update every 5 seconds
    const statusInterval = setInterval(updateRealtimeStatus, 5000);

    return () => clearInterval(statusInterval);
  }, []);

  const loadExtensions = async () => {
    try {
      setLoading(true);
      const data = await extensionService.getExtensions();
      setExtensions(data);
      setError(null);
    } catch (err) {
      setError('Failed to load extensions');
      console.error('Error loading extensions:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return '🟢';
      case 'offline':
        return '🔴';
      case 'unknown':
        return '🟡';
      default:
        return '⚪';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'text-green-600 dark:text-green-400';
      case 'offline':
        return 'text-red-600 dark:text-red-400';
      case 'unknown':
        return 'text-yellow-600 dark:text-yellow-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden h-full flex flex-col">
      <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Extensions Status</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Real-time extension status and agent information
              </p>
            </div>
          </div>
          
          {/* Real-time Status Indicator */}
          <div className="flex items-center space-x-2">
            <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium ${
              realtimeStatus === 'connected' 
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                : realtimeStatus === 'disconnected'
                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                realtimeStatus === 'connected' 
                  ? 'bg-green-500 animate-pulse' 
                  : realtimeStatus === 'disconnected'
                  ? 'bg-yellow-500'
                  : 'bg-gray-500'
              }`}></div>
              <span>
                {realtimeStatus === 'connected' ? 'Live' : 
                 realtimeStatus === 'disconnected' ? 'Reconnecting' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex-1 min-h-0 flex flex-col">
        {loading ? (
          <div className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-3"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center justify-center flex-1 p-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <p className="text-red-600 dark:text-red-400 text-sm font-medium">{error}</p>
              <button 
                onClick={loadExtensions}
                className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        ) : extensions.length === 0 ? (
          <div className="flex items-center justify-center flex-1 p-6">
            <div className="text-center">
              <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h4 className="text-gray-900 dark:text-white font-medium mb-1">No Extensions Found</h4>
              <p className="text-gray-500 dark:text-gray-400 text-sm">No extensions are currently configured</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto narrow-scrollbar">
            <div className="p-4 space-y-3">
              {extensions.map((extension) => (
                <div 
                  key={extension.id} 
                  className={`flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 hover:shadow-md transition-all duration-300 ${
                    extension.status === 'online' ? 'ring-2 ring-green-200 dark:ring-green-800/30' : ''
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center">
                        <span className="text-indigo-600 dark:text-indigo-400 font-semibold text-sm">
                          {extension.extension}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {extension.agent_name || `Extension ${extension.extension}`}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Extension {extension.extension}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className={`text-sm font-medium ${getStatusColor(extension.status)}`}>
                      {getStatusIcon(extension.status)} {extension.status}
                    </div>
                    {extension.last_seen && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Last seen: {new Date(extension.last_seen).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Summary */}
        {extensions.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex-shrink-0">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {extensions.length}
                </div>
                <div className="text-xs text-indigo-600 dark:text-indigo-400">Total Extensions</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {extensions.filter(ext => ext.status === 'online').length}
                </div>
                <div className="text-xs text-green-600 dark:text-green-400">Online</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {extensions.filter(ext => ext.status === 'offline').length}
                </div>
                <div className="text-xs text-red-600 dark:text-red-400">Offline</div>
              </div>
            </div>
            
            {/* Last Update Indicator */}
            {lastUpdate && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="text-center">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Last real-time update: {lastUpdate.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentsStatus;
