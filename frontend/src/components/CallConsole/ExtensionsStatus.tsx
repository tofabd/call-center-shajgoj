import React, { useState, useEffect } from 'react';
import { extensionService } from '../../services/extensionService';
// Real-time features disabled for MongoDB API
// import { extensionRealtimeService } from '../../services/extensionRealtimeService';
import type { Extension } from '../../services/extensionService';
// import type { ExtensionStatusUpdate } from '../../services/extensionRealtimeService';

const ExtensionsStatus: React.FC = () => {
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'disconnected' | 'unavailable'>('unavailable');

  useEffect(() => {
    loadExtensions();
    
    // Real-time features disabled for MongoDB API
    // Subscribe to real-time extension status updates
    // const unsubscribe = extensionRealtimeService.subscribeToAll((update: ExtensionStatusUpdate) => {
    //   setExtensions(prevExtensions => 
    //     prevExtensions.map(ext => 
    //       ext.id === update.id 
    //         ? { ...ext, ...update } as Extension
    //         : ext
    //     )
    //   );
    // });
    
    // Increased polling frequency since real-time is disabled
    const interval = setInterval(loadExtensions, 30000); // Poll every 30 seconds
    
    return () => {
      // unsubscribe();
      clearInterval(interval);
    };
  }, []);

  // Real-time connection status monitoring disabled for MongoDB API
  // useEffect(() => {
  //   const updateRealtimeStatus = () => {
  //     setRealtimeStatus(extensionRealtimeService.getConnectionStatus());
  //   };

  //   // Update immediately
  //   updateRealtimeStatus();

  //   // Update every 5 seconds
  //   const statusInterval = setInterval(updateRealtimeStatus, 5000);

  //   return () => clearInterval(statusInterval);
  // }, []);
  
  // Set real-time status to unavailable since MongoDB API doesn't support it
  useEffect(() => {
    setRealtimeStatus('unavailable');
  }, []);

  const loadExtensions = async () => {
    try {
      setLoading(true);
      const data = await extensionService.getExtensions();
      setExtensions(data);
      setError(null);
    } catch (err) {
      console.error('Error loading extensions:', err);
      setError('Failed to load extensions');
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

  // Sort extensions to show online first, and filter out inactive extensions
  const sortedExtensions = [...extensions]
    .filter(extension => {
      // Filter for clean extension numbers (1001-1020, 2001-2020) and active extensions
      const isCleanExtension = /^[12]\d{3}$/.test(extension.extension); // Matches 1001-1999 or 2001-2999
      const isActive = extension.is_active !== false;
      return isCleanExtension && isActive;
    })
    .sort((a, b) => {
      // Define priority order: online > unknown > offline
      const statusPriority = {
        'online': 0,
        'unknown': 1,
        'offline': 2
      };
      
      const aPriority = statusPriority[a.status as keyof typeof statusPriority] ?? 3;
      const bPriority = statusPriority[b.status as keyof typeof statusPriority] ?? 3;
      
      // Primary sort by status priority
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      // Secondary sort by extension number (ascending)
      return a.extension.localeCompare(b.extension, undefined, { numeric: true });
    });

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
                Extension status (polling mode)
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
              {sortedExtensions.map((extension) => (
                <div 
                  key={extension.id} 
                  className={`flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 hover:shadow-md transition-all duration-300 min-h-[80px] ${
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
        

      </div>
    </div>
  );
};

export default ExtensionsStatus;
