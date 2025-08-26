import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { StatusTooltip } from '../common/StatusTooltip';
import { extensionService } from '../../services/extensionService';
import socketService from '../../services/socketService';
import type { ExtensionStatusEvent } from '../../services/socketService';
import type { Extension } from '../../services/extensionService';
import { connectionHealthService, type ConnectionHealth } from '../../services/connectionHealthService';

interface ExtensionsStatusProps {}

const ExtensionsStatus: React.FC<ExtensionsStatusProps> = () => {
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'disconnected' | 'reconnecting' | 'checking'>('checking');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [connectionHealth, setConnectionHealth] = useState<'good' | 'poor' | 'stale'>('good');
  const [updateCount, setUpdateCount] = useState(0);
  const [avgUpdateInterval, setAvgUpdateInterval] = useState<number | null>(null);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);

  useEffect(() => {
    // Initial load from database
    loadExtensions();
    
    // Set up 30-second automatic refresh from database
    const startAutoRefresh = () => {
      const interval = setInterval(() => {
        if (isPageVisible && !isRefreshing) {
          console.log('🔄 Auto refresh: Loading extensions from database (30s interval)');
          setIsAutoRefreshing(true);
          loadExtensions(true).finally(() => {
            setTimeout(() => {
              setIsAutoRefreshing(false);
            }, 1000);
          });
        }
      }, 30000); // 30 seconds
      
      setAutoRefreshInterval(interval);
      console.log('⏰ Started automatic database refresh every 30 seconds');
      return interval;
    };

    startAutoRefresh();
    
    // Subscribe to real-time extension status updates (for immediate updates)
    const handleExtensionUpdate = (update: ExtensionStatusEvent) => {
      console.log('📱 Real-time extension update received:', update);
      
      const now = new Date();
      
      // Calculate update frequency
      if (lastUpdate) {
        const updateInterval = now.getTime() - lastUpdate.getTime();
        setAvgUpdateInterval(prev => prev ? (prev + updateInterval) / 2 : updateInterval);
      }
      
      setLastUpdate(now);
      setUpdateCount(prev => prev + 1);
      
      setExtensions(prevExtensions => 
        prevExtensions.map(ext => 
          ext.extension === update.extension 
            ? { 
                ...ext, 
                status: update.status,
                agent_name: update.agent_name || ext.agent_name,
                last_seen: update.last_seen || ext.last_seen
              } as Extension
            : ext
        )
      );
    };
    
    socketService.onExtensionStatusUpdated(handleExtensionUpdate);
    
    // Handle page visibility changes
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      setIsPageVisible(isVisible);
      
      if (isVisible) {
        console.log('📱 Page became visible, refreshing extensions from database...');
        loadExtensions(true);
        
        // Reconnect socket if needed
        if (!socketService.isConnected()) {
          socketService.reconnect();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Cleanup on unmount
    return () => {
      if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        console.log('⏹️ Stopped automatic database refresh');
      }
      socketService.removeAllListeners();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isPageVisible, isRefreshing]);

  // Subscribe to unified connection health service
  useEffect(() => {
    console.log('📡 ExtensionsStatus: Subscribing to unified connection health service');
    
    const unsubscribe = connectionHealthService.subscribe((health: ConnectionHealth) => {
      console.log('📡 ExtensionsStatus: Received connection health update:', health);
      
      setRealtimeStatus(health.status);
      setConnectionHealth(health.health);
    });
    
    return () => {
      console.log('📡 ExtensionsStatus: Unsubscribing from connection health service');
      unsubscribe();
    };
  }, []);

  const loadExtensions = async (isRefresh = false) => {
    const dbStartTime = Date.now();
    try {
      if (!isRefresh) {
        setLoading(true);
      }
      
      console.log(`💾 ${isRefresh ? 'Refreshing' : 'Loading'} extensions from database...`);
      const data = await extensionService.getExtensions();
      const dbTime = Date.now() - dbStartTime;
      
      setExtensions(data);
      setError(null);
      
      // Update last update time
      setLastUpdate(new Date());
      
      console.log(`✅ Extensions loaded from database: ${data.length} extensions in ${dbTime}ms`);
    } catch (err) {
      const dbTime = Date.now() - dbStartTime;
      console.error(`❌ Error loading extensions from database after ${dbTime}ms:`, err);
      setError('Failed to load extensions from database');
    } finally {
      if (!isRefresh) {
        setLoading(false);
      }
    }
  };

  const handleRefresh = useCallback(() => {
    console.log('🔄 Manual refresh triggered - triggering AMI query and database update');
    setIsRefreshing(true);
    
    // Reset the periodic timer
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      console.log('⏰ Periodic timer reset due to manual refresh');
    }
    
    // Trigger AMI refresh first, then load from database
    extensionService.refreshStatus()
      .then((result) => {
        console.log('✅ AMI refresh completed, extensions updated in database:', result);
        // After AMI refresh, reload extensions from database to get updated status
        return loadExtensions(true);
      })
      .catch((error) => {
        console.error('❌ AMI refresh failed:', error);
        // Fallback to database reload if AMI refresh fails
        return loadExtensions(true);
      })
      .finally(() => {
        setTimeout(() => {
          setIsRefreshing(false);
          
          // Restart the periodic timer after manual refresh
          const newInterval = setInterval(() => {
            if (isPageVisible && !isRefreshing) {
              console.log('🔄 Auto refresh: Loading extensions from database (30s interval)');
              setIsAutoRefreshing(true);
              loadExtensions(true).finally(() => {
                setTimeout(() => {
                  setIsAutoRefreshing(false);
                }, 1000);
              });
            }
          }, 30000);
          setAutoRefreshInterval(newInterval);
          console.log('⏰ Restarted automatic database refresh timer');
        }, 1000); // Keep spinning for visual feedback
      });
  }, [autoRefreshInterval, isPageVisible, isRefreshing]);

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

  // Sort extensions and filter out AMI-generated codes and unknown status
  const sortedExtensions = [...extensions]
    .filter(extension => {
      // Filter out inactive extensions
      const isActive = extension.is_active !== false;
      
      // Filter out AMI-generated extension codes using regex pattern
      // Only show clean 4-digit extension numbers (pattern: /^\d{4}$/)
      // This allows 1000-9999 but excludes codes like *47*1001, *47*1001*600
      const isValidExtension = /^\d{4}$/.test(extension.extension);
      
      // Filter out extensions with unknown status
      const hasKnownStatus = extension.status !== 'unknown';
      
      return isActive && isValidExtension && hasKnownStatus;
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

  // Calculate statistics from sorted extensions
  const onlineCount = sortedExtensions.filter(ext => ext.status === 'online').length;
  const offlineCount = sortedExtensions.filter(ext => ext.status === 'offline').length;
  const unknownCount = sortedExtensions.filter(ext => ext.status === 'unknown').length;
  const totalCount = sortedExtensions.length;

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
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-green-600 dark:text-green-400">{onlineCount} Online</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-red-600 dark:text-red-400">{offlineCount} Offline</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Refresh Button and Connection Status */}
          <div className="flex items-center space-x-3">            
            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              className={`p-2 rounded-lg transition-all duration-200 group cursor-pointer ${
                isRefreshing || isAutoRefreshing
                  ? 'bg-blue-100 dark:bg-blue-900/30' 
                  : 'bg-white/80 dark:bg-gray-700/80 hover:bg-white dark:hover:bg-gray-700 hover:shadow-md'
              }`}
              title={(isRefreshing || isAutoRefreshing) ? 'Refreshing...' : 'Click to refresh extensions'}
              disabled={isRefreshing || isAutoRefreshing}
            >
              <RefreshCw className={`h-4 w-4 transition-all duration-200 ${
                isRefreshing || isAutoRefreshing
                  ? 'text-blue-600 dark:text-blue-400 animate-spin'
                  : 'text-gray-600 dark:text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:scale-110'
              }`} />
            </button>
            
                         {/* Connection Status - Icon Only with StatusTooltip */}
             <div className="flex items-center px-3 py-2 rounded-lg text-sm font-medium bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300">
               <StatusTooltip status={realtimeStatus} health={connectionHealth}>
                 <span className="relative flex size-3 cursor-help group">
                   {realtimeStatus === 'connected' && connectionHealth === 'good' && (
                     <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                   )}
                   <span className={`relative inline-flex size-3 rounded-full transition-all duration-200 ${
                     realtimeStatus === 'connected'
                       ? connectionHealth === 'good'
                         ? 'bg-green-500 group-hover:bg-green-600'
                         : connectionHealth === 'poor'
                         ? 'bg-yellow-500 group-hover:bg-yellow-600'
                         : 'bg-orange-500 group-hover:bg-orange-600'
                       : realtimeStatus === 'reconnecting'
                       ? 'bg-blue-500 group-hover:bg-blue-600'
                       : realtimeStatus === 'checking'
                       ? 'bg-gray-500 group-hover:bg-gray-600'
                       : 'bg-red-500 group-hover:bg-red-600'
                   }`}></span>
                 </span>
               </StatusTooltip>
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
                onClick={() => loadExtensions()}
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
