import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import ExtensionStatsModal from '../common/ExtensionStatsModal';
import { extensionService } from '../../services/extensionService';
import type { Extension } from '../../services/extensionService';
import extensionRealtimeService, { type ExtensionStatusUpdate } from '../../services/extensionRealtimeService';

import { getUnifiedExtensionStatus, isExtensionOnCall, debugStatusMismatch } from '../../utils/statusUtils';

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

  // Duration update timer for real-time duration display
  const [durationUpdateTimer, setDurationUpdateTimer] = useState<NodeJS.Timeout | null>(null);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedExtensionNumber, setSelectedExtensionNumber] = useState<string>('');
  const [extensionStats, setExtensionStats] = useState<any | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  


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
    
    // Subscribe to real-time extension status updates
    const handleExtensionUpdate = (update: ExtensionStatusUpdate) => {
      console.log('📱 Real-time extension update received:', update);
      
      setExtensions(prevExtensions => 
        prevExtensions.map(ext => {
          if (ext.id === update.id || ext.extension === update.extension) {
            const updatedExt = { 
              ...ext, 
              agent_name: update.agent_name || ext.agent_name,
              status: update.status || ext.status,
              availability_status: update.availability_status || ext.availability_status,
              status_code: update.status_code !== undefined ? update.status_code : ext.status_code,
              status_text: update.status_text || ext.status_text,
              device_state: update.device_state || ext.device_state,
              last_status_change: update.last_status_change || ext.last_status_change,
              status_changed_at: update.status_changed_at || ext.status_changed_at,
              updated_at: update.updated_at || ext.updated_at
            };
            
            // Debug logging for status changes
            const oldStatus = getUnifiedExtensionStatus({ device_state: ext.device_state, status_code: ext.status_code });
            const newStatus = getUnifiedExtensionStatus({ device_state: updatedExt.device_state, status_code: updatedExt.status_code });
            
            if (oldStatus !== newStatus) {
              debugStatusMismatch(ext.extension, `${oldStatus} → ${newStatus}`, undefined, {
                update_source: 'echo',
                old_device_state: ext.device_state,
                new_device_state: updatedExt.device_state,
                old_status_code: ext.status_code,
                new_status_code: updatedExt.status_code
              });
            }
            
            return updatedExt;
          }
          return ext;
        })
      );
    };

    // Subscribe to Echo extension updates
    const unsubscribe = extensionRealtimeService.subscribeToAll(handleExtensionUpdate);
    console.log('📡 ExtensionsStatus: Subscribed to real-time extension updates');
    
    // Cleanup on unmount
    return () => {
      if (durationUpdateTimer) {
        clearInterval(durationUpdateTimer);
        console.log('⏹️ Stopped duration update timer');
      }
      
      // Clean up WebSocket listeners
      unsubscribe();
      console.log('📡 ExtensionsStatus: Cleaned up Echo listeners');
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
    console.log('🔄 Manual refresh triggered');
    setIsRefreshing(true);
    
    // Load extensions from database
    loadExtensions(true)
      .then(() => {
        console.log('✅ Manual refresh completed - extensions loaded from database');
      })
      .catch((error) => {
        console.error('❌ Manual refresh failed:', error);
      })
      .finally(() => {
        setTimeout(() => {
          setIsRefreshing(false);
        }, 1000); // Keep spinning for visual feedback
      });
  }, []);

  // Add keyboard event listener for manual refresh (Ctrl+R or F5)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+R or F5 for manual refresh
      if ((event.ctrlKey && event.key === 'r') || event.key === 'F5') {
        event.preventDefault(); // Prevent default browser refresh
        if (!isRefreshing) {
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
  }, [isRefreshing, handleRefresh]);

  // Add double-click event for manual refresh on the header
  const handleHeaderDoubleClick = useCallback(() => {
    if (!isRefreshing) {
      console.log('🖱️ Header double-click detected - triggering manual refresh');
      handleRefresh();
    }
  }, [isRefreshing, handleRefresh]);

  // Add right-click context menu event for manual refresh
  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    if (!isRefreshing) {
      console.log('🖱️ Right-click context menu detected - triggering manual refresh');
      handleRefresh();
    }
  }, [isRefreshing, handleRefresh]);



  const handleExtensionClick = useCallback(async (extension: Extension) => {
    console.log('📱 Extension clicked:', extension);
    setSelectedExtensionNumber(extension.extension);
    setIsModalOpen(true);
    setStatsLoading(true);
    setStatsError(null);
    setExtensionStats(null);

    try {
      // Import callService dynamically
      const { callService } = await import('../../services/callService');
      const stats = await callService.getExtensionStats(extension.extension, 'today');
      setExtensionStats(stats);
      console.log('📊 Extension statistics loaded:', stats);
    } catch (error) {
      console.error('❌ Failed to load extension statistics:', error);
      setStatsError('Failed to load call statistics for this extension');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedExtensionNumber('');
    setExtensionStats(null);
    setStatsError(null);
  }, []);



  // Extension gradient and style functions based on design guide
  const getExtensionGradient = (status: string, isOnCall: boolean): string => {
    if (status === 'online') {
      return isOnCall
        ? 'bg-linear-to-br from-emerald-500 to-green-700 dark:from-emerald-700 dark:to-green-900 shadow-emerald-300/70'
        : 'bg-linear-to-br from-emerald-400 to-green-600 dark:from-emerald-600 dark:to-green-800 shadow-emerald-200/50';
    } else if (status === 'offline') {
      return 'bg-linear-to-br from-red-400 to-rose-500 shadow-red-200/50 dark:from-red-500 dark:to-rose-600 dark:shadow-red-900/20';
    } else if (status === 'unknown') {
      return 'bg-linear-to-br from-yellow-400 to-amber-500 shadow-yellow-200/50 dark:from-yellow-500 dark:to-amber-600 dark:shadow-yellow-900/20';
    }
    return 'bg-linear-to-br from-gray-400 to-slate-500 shadow-gray-200/50 dark:from-gray-500 dark:to-slate-600';
  };

  const getExtensionItemBackground = (status: string, isOnCall: boolean): string => {
    if (status === 'online') {
      return isOnCall
        ? 'bg-linear-to-r from-green-100 via-green-200 to-green-100 dark:from-green-800/50 dark:via-green-700/50 dark:to-green-800/50 border-green-400 dark:border-green-600/50 ring-1 ring-green-300 dark:ring-green-700/40'
        : 'bg-linear-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-300 dark:border-green-700/30';
    } else if (status === 'offline') {
      return 'bg-linear-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border-red-300 dark:border-red-700/30';
    } else if (status === 'unknown') {
      return 'bg-linear-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-yellow-300 dark:border-yellow-700/30';
    }
    return 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600';
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

  const getDeviceStateLabel = (deviceState: string, statusCode: number): string => {
    // Use unified status logic
    return getUnifiedExtensionStatus({ device_state: deviceState, status_code: statusCode });
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
    <div className="bg-white dark:bg-gray-800 lg:rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden h-full flex flex-col">
             <div 
         className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-linear-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 shrink-0 cursor-pointer"
         onDoubleClick={handleHeaderDoubleClick}
         onContextMenu={handleContextMenu}
          title="Double-click or right-click to refresh extensions. Auto-refreshes from database every 30s"
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
            {/* Real-time Status */}
            {isRefreshing && (
              <div className="flex items-center px-2 py-1 rounded-lg text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 min-w-[80px] justify-center">
                Updating...
              </div>
            )}
            
                         {/* Refresh Button */}
             <button
               onClick={handleRefresh}
               className={`p-2 rounded-lg transition-all duration-200 group cursor-pointer ${
                 isRefreshing
                   ? 'bg-blue-100 dark:bg-blue-900/30' 
                   : 'bg-white/80 dark:bg-gray-700/80 hover:bg-white dark:hover:bg-gray-700 hover:shadow-md'
               }`}
                title={isRefreshing ? 'Refreshing...' : 'Click to refresh extensions'}
               disabled={isRefreshing}
             >
              <RefreshCw className={`h-4 w-4 transition-all duration-200 ${
                isRefreshing
                  ? 'text-blue-600 dark:text-blue-400 animate-spin'
                  : 'text-gray-600 dark:text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:scale-110'
              }`} />
            </button>
            

          </div>
        </div>
      </div>
      

      
      <div className="flex-1 min-h-0 flex flex-col">
        {loading && extensions.length === 0 ? (
          <div className="flex items-center justify-center flex-1 p-6">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Loading extensions...</p>
            </div>
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
             <div className="space-y-2 p-2">
                 {sortedExtensions.map((extension) => {
                   const isOnCall = isExtensionOnCall({ device_state: extension.device_state, status_code: extension.status_code });
                   const statusColor = extension.status === 'online' ? 'bg-green-100 text-green-600' : extension.status === 'offline' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600';
                   const duration = getDurationDisplay(extension);
                   
                   // Background color based on extension status
                   const getCardBackground = () => {
                     if (extension.status === 'online') {
                       return isOnCall 
                         ? 'bg-green-200 dark:bg-green-800/40 border-green-300 dark:border-green-600' // Deep green for on-call
                         : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700/30'; // Lite green for free
                     } else if (extension.status === 'offline') {
                       return 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700';
                     } else {
                       return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700/30';
                     }
                   };
                   
                   return (
                    <div
                      key={extension.id}
                       className={`flex items-center justify-between shadow p-2 rounded-xl hover:shadow-lg transition-all duration-200 border mx-0 cursor-pointer ${getCardBackground()}`}
                       onClick={() => handleExtensionClick(extension)}
                       title={`Click to view call statistics for ${extension.agent_name || extension.extension}`}
                    >
                     <div className="flex items-center space-x-3">
                        <div className="shrink-0 relative">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center p-1 transition-all duration-300 group-hover:scale-110 ${
                              getExtensionGradient(extension.status, isOnCall)
                            }`}>
                            <span className="text-white font-bold text-sm drop-shadow-md">
                              {extension.extension}
                            </span>
                          </div>

                            {/* Pulse effect for extensions on call - outside the circle only */}
                            {extension.status === 'online' && isOnCall && (
                              <div className="absolute inset-0 rounded-full bg-emerald-600 dark:bg-emerald-800 animate-ping opacity-60 dark:opacity-80"></div>
                            )}
                       </div>
                       <div>
                          <h3 className="text-gray-800 dark:text-gray-200 font-semibold">
                            {extension.agent_name || `Extension ${extension.extension}`}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {getDeviceStateLabel(extension.device_state, extension.status_code)}
                          </p>
                       </div>
                     </div>
                     
                     <div className="text-right flex flex-col">
                       <div className={`text-sm font-medium ${getStatusColor(extension.status)}`}>
                         {getStatusIcon(extension.status)} {extension.status}
                       </div>
                       {extension.last_status_change && (
                         <div className={`text-xs font-medium ${
                           extension.status === 'online'
                             ? 'text-blue-600 dark:text-blue-400'
                             : 'text-orange-600 dark:text-orange-400'
                         }`}>
                           {getDurationDisplay(extension)}
                         </div>
                       )}
                     </div>
                   </div>
                   );
                 })}
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
          extensionNumber={selectedExtensionNumber}
        />

      </div>
    </div>
  );
};

export default ExtensionsStatus;
