import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { StatusTooltip } from '../common/StatusTooltip';
import ExtensionStatsModal from '../common/ExtensionStatsModal';
import { extensionService } from '../../services/extensionService';
import socketService from '../../services/socketService';
import type { ExtensionStatusEvent } from '../../services/socketService';
import type { Extension, ExtensionCallStats } from '../../services/extensionService';
import { connectionHealthService, type ConnectionHealth } from '../../services/connectionHealthService';

// Utility function to calculate duration since status change
const getDurationSinceStatusChange = (lastStatusChange?: string): string => {
  if (!lastStatusChange) return '';
  
  const statusChangeTime = new Date(lastStatusChange);
  const now = new Date();
  const diffMs = now.getTime() - statusChangeTime.getTime();
  
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
};

// Utility function to format duration display
const getDurationDisplay = (extension: Extension): string => {
  if (!extension.last_status_change) return '';
  
  const duration = getDurationSinceStatusChange(extension.last_status_change);
  if (!duration) return '';
  
  if (extension.status === 'online') {
    return `Online for ${duration}`;
  } else if (extension.status === 'offline') {
    return `Offline for ${duration}`;
  }
  
  return '';
};

const ExtensionsStatus: React.FC = () => {
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'disconnected' | 'reconnecting' | 'checking'>('checking');

  const [connectionHealth, setConnectionHealth] = useState<'good' | 'poor' | 'stale'>('good');

  const [isPageVisible, setIsPageVisible] = useState(true);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(30);
  
  // Duration update timer for real-time duration display
  const [durationUpdateTimer, setDurationUpdateTimer] = useState<NodeJS.Timeout | null>(null);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedExtension, setSelectedExtension] = useState<Extension | null>(null);
  const [extensionStats, setExtensionStats] = useState<ExtensionCallStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  


  // Countdown timer effect
  useEffect(() => {
    if (!isRefreshing && !isAutoRefreshing) {
      const countdownInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            return 30; // Reset to 30 seconds
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(countdownInterval);
    }
  }, [isRefreshing, isAutoRefreshing]);

  // Reset countdown when refresh occurs
  useEffect(() => {
    if (isRefreshing || isAutoRefreshing) {
      setCountdown(30);
    }
  }, [isRefreshing, isAutoRefreshing]);

  // Duration update timer effect - updates duration display every second
  useEffect(() => {
    const timer = setInterval(() => {
      // Force re-render to update duration display
      setExtensions(prevExtensions => [...prevExtensions]);
    }, 1000);
    
    setDurationUpdateTimer(timer);
    
    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, []);

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
        
        // Restart duration update timer
        if (durationUpdateTimer) {
          clearInterval(durationUpdateTimer);
        }
        const newTimer = setInterval(() => {
          setExtensions(prevExtensions => [...prevExtensions]);
        }, 1000);
        setDurationUpdateTimer(newTimer);
        
        // Reconnect socket if needed
        if (!socketService.isConnected()) {
          socketService.reconnect();
        }
      } else {
        // Clear duration timer when page becomes hidden to save resources
        if (durationUpdateTimer) {
          clearInterval(durationUpdateTimer);
          setDurationUpdateTimer(null);
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
      if (durationUpdateTimer) {
        clearInterval(durationUpdateTimer);
        console.log('⏹️ Stopped duration update timer');
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

  const loadExtensions = async (isRefresh = false, retryCount = 0) => {
    const dbStartTime = Date.now();
    const maxRetries = 2;
    
    try {
      if (!isRefresh) {
        setLoading(true);
      }
      
      console.log(`💾 ${isRefresh ? 'Refreshing' : 'Loading'} extensions from database... (attempt ${retryCount + 1})`);
      const data = await extensionService.getExtensions();
      const dbTime = Date.now() - dbStartTime;
      
      // Validate that we received valid data
      if (!data || !Array.isArray(data)) {
        throw new Error('Invalid data format received from database');
      }
      
      // Check if we have extensions data
      if (data.length === 0) {
        console.warn('⚠️ No extensions found in database - this might indicate a data issue');
      }
      
      setExtensions(data);
      setError(null);
      
      console.log(`✅ Extensions loaded from database: ${data.length} extensions in ${dbTime}ms`);
      
      // If this was a retry, log success
      if (retryCount > 0) {
        console.log(`🔄 Retry successful after ${retryCount} attempts`);
      }
      
    } catch (err) {
      const dbTime = Date.now() - dbStartTime;
      console.error(`❌ Error loading extensions from database after ${dbTime}ms:`, err);
      
      // Implement retry logic for database failures
      if (retryCount < maxRetries) {
        console.log(`🔄 Retrying database load in 1 second... (attempt ${retryCount + 1}/${maxRetries})`);
        setTimeout(() => {
          loadExtensions(isRefresh, retryCount + 1);
        }, 1000);
        return; // Don't set error state yet, we're retrying
      }
      
      // After max retries, set error state
      setError(`Failed to load extensions from database after ${maxRetries} attempts: ${err instanceof Error ? err.message : String(err)}`);
      
      // If this was a refresh operation, try to load from cache/previous state
      if (isRefresh && extensions.length > 0) {
        console.log('🔄 Refresh failed, keeping previous extension data');
      }
      
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
        
        // Add a small delay to ensure database is updated before loading
        return new Promise(resolve => setTimeout(resolve, 500));
      })
      .then(() => {
        // After delay, reload extensions from database to get updated status
        console.log('🔄 Loading updated extensions from database after AMI refresh...');
        return loadExtensions(true);
      })
      .catch((error) => {
        console.error('❌ AMI refresh failed:', error);
        // Fallback to database reload if AMI refresh fails
        console.log('🔄 Fallback: Loading extensions from database due to AMI failure...');
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
          
          // Restart duration update timer
          if (durationUpdateTimer) {
            clearInterval(durationUpdateTimer);
          }
          const newDurationTimer = setInterval(() => {
            setExtensions(prevExtensions => [...prevExtensions]);
          }, 1000);
          setDurationUpdateTimer(newDurationTimer);
          console.log('⏰ Restarted duration update timer');
        }, 1000); // Keep spinning for visual feedback
      });
  }, [autoRefreshInterval, isPageVisible, isRefreshing]);

  // Add keyboard event listener for manual refresh (Ctrl+R or F5)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+R or F5 for manual refresh
      if ((event.ctrlKey && event.key === 'r') || event.key === 'F5') {
        event.preventDefault(); // Prevent default browser refresh
        if (!isRefreshing && !isAutoRefreshing) {
          console.log('⌨️ Keyboard shortcut detected - triggering manual refresh');
          handleRefresh();
        }
      }
    };

    // Add event listener
    document.addEventListener('keydown', handleKeyDown);
    
    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isRefreshing, isAutoRefreshing, handleRefresh]);

  // Add double-click event for manual refresh on the header
  const handleHeaderDoubleClick = useCallback(() => {
    if (!isRefreshing && !isAutoRefreshing) {
      console.log('🖱️ Header double-click detected - triggering manual refresh');
      handleRefresh();
    }
  }, [isRefreshing, isAutoRefreshing, handleRefresh]);

  // Add right-click context menu event for manual refresh
  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    if (!isRefreshing && !isAutoRefreshing) {
      console.log('🖱️ Right-click context menu detected - triggering manual refresh');
      handleRefresh();
    }
  }, [isRefreshing, isAutoRefreshing, handleRefresh]);



  const handleExtensionClick = useCallback(async (extension: Extension) => {
    console.log('📱 Extension clicked:', extension);
    setSelectedExtension(extension);
    setIsModalOpen(true);
    setStatsLoading(true);
    setStatsError(null);
    setExtensionStats(null);

    try {
      const stats = await extensionService.getExtensionCallStatistics(extension._id);
      setExtensionStats(stats);
      console.log('✅ Extension statistics loaded:', stats);
    } catch (error) {
      console.error('❌ Failed to load extension statistics:', error);
      setStatsError('Failed to load call statistics for this extension');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedExtension(null);
    setExtensionStats(null);
    setStatsError(null);
  }, []);



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

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden h-full flex flex-col">
             <div 
         className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 flex-shrink-0 cursor-pointer"
         onDoubleClick={handleHeaderDoubleClick}
         onContextMenu={handleContextMenu}
         title="Double-click or right-click to refresh extensions"
       >
         <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
                         <div>
               <div className="flex items-center space-x-3">
                 <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Extensions Status</h3>
                 {/* Real-time status indicator with reusable StatusTooltip */}
                 <div className="flex items-center">
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
            {/* Countdown Timer / Updating Status */}
            <div className="flex items-center px-2 py-1 rounded-lg text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 min-w-[60px] justify-center">
              {!(isRefreshing || isAutoRefreshing) && <span className="mr-1">⏰</span>}
              {isRefreshing || isAutoRefreshing ? 'Updating...' : `${countdown}s`}
            </div>
            
                         {/* Refresh Button */}
             <button
               onClick={handleRefresh}
               className={`p-2 rounded-lg transition-all duration-200 group cursor-pointer ${
                 isRefreshing || isAutoRefreshing
                   ? 'bg-blue-100 dark:bg-blue-900/30' 
                   : 'bg-white/80 dark:bg-gray-700/80 hover:bg-white dark:hover:bg-gray-700 hover:shadow-md'
               }`}
                               title={(isRefreshing || isAutoRefreshing) ? 'Refreshing...' : 'Click to refresh extensions (or use Ctrl+R, F5, double-click header, or right-click header)'}
               disabled={isRefreshing || isAutoRefreshing}
             >
              <RefreshCw className={`h-4 w-4 transition-all duration-200 ${
                isRefreshing || isAutoRefreshing
                  ? 'text-blue-600 dark:text-blue-400 animate-spin'
                  : 'text-gray-600 dark:text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:scale-110'
              }`} />
            </button>
            

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
                  className={`flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 hover:shadow-md transition-all duration-300 min-h-[80px] cursor-pointer ${
                    extension.status === 'online' ? 'ring-2 ring-green-200 dark:ring-green-800/30' : ''
                  }`}
                  onClick={() => handleExtensionClick(extension)}
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
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {extension.device_state}
                    </div>
                    {extension.last_status_change && (
                      <div className={`text-xs font-medium ${
                        extension.status === 'online' 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {getDurationDisplay(extension)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Extension Statistics Modal */}
        <ExtensionStatsModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          stats={extensionStats}
          loading={statsLoading}
          error={statsError}
        />

      </div>
    </div>
  );
};

export default ExtensionsStatus;
