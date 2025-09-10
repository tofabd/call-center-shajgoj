import React, { useState, useEffect } from 'react';
import { X, Phone, PhoneIncoming, PhoneOutgoing, Clock, CheckCircle, XCircle, AlertCircle, BarChart3, List, ChevronDown, Activity, TrendingUp, Timer, Filter } from 'lucide-react';
import type { ExtensionStatistics } from '../../services/callService';
import { callService } from '../../services/callService';

interface ExtensionStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: ExtensionStatistics | null;
  loading: boolean;
  error: string | null;
  extensionNumber?: string;
}

interface ExtensionCall {
  id: string;
  direction: string;
  other_party: string;
  started_at: string;
  answered_at?: string;
  ended_at?: string;
  duration: number;
  status: string;
  linkedid?: string;
}

type ViewMode = 'total' | 'incoming' | 'outgoing';

const ExtensionStatsModal: React.FC<ExtensionStatsModalProps> = ({
  isOpen,
  onClose,
  stats,
  loading,
  error,
  extensionNumber
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('total');
  const [showAllCalls, setShowAllCalls] = useState(false);
  const [allCalls, setAllCalls] = useState<ExtensionCall[]>([]);
  const [loadingCalls, setLoadingCalls] = useState(false);
  const [callsError, setCallsError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Function to fetch all calls for the extension
  const fetchAllCalls = async (infinite = false) => {
    if (!stats?.extension && !extensionNumber) return;
    
    const extension = stats?.extension || extensionNumber!;
    const period = stats?.period?.type || 'today';
    
    setLoadingCalls(true);
    setCallsError(null);
    
    try {
      const response = await callService.getExtensionCalls(extension, period as 'today' | 'week' | 'month');
      if (infinite) {
        setAllCalls(prev => [...prev, ...response.calls]);
      } else {
        setAllCalls(response.calls);
      }
    } catch (err: unknown) {
      setCallsError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to load calls');
    } finally {
      setLoadingCalls(false);
    }
  };

  // Calculate filtered statistics based on view mode
  const getFilteredStats = () => {
    if (!stats) return null;
    
    let callCount = 0;
    let answeredCount = 0;
    let statusBreakdown = {};
    let filteredCalls: ExtensionCall[] = [];
    
    // Get the correct counts from backend data
    switch (viewMode) {
      case 'incoming':
        callCount = stats.direction_breakdown.incoming;
        // Count completed calls as answered (backend uses 'completed' for answered calls)
        answeredCount = Object.keys(stats.incoming_by_status)
          .filter(status => status === 'completed' || status === 'answered')
          .reduce((sum, status) => sum + (stats.incoming_by_status[status] || 0), 0);
        statusBreakdown = stats.incoming_by_status;
        // Filter calls for performance calculation
        if (allCalls.length > 0) {
          filteredCalls = allCalls.filter(call => call.direction === 'incoming');
        }
        break;
      case 'outgoing':
        callCount = stats.direction_breakdown.outgoing;
        // Count completed calls as answered (backend uses 'completed' for answered calls)
        answeredCount = Object.keys(stats.outgoing_by_status)
          .filter(status => status === 'completed' || status === 'answered')
          .reduce((sum, status) => sum + (stats.outgoing_by_status[status] || 0), 0);
        statusBreakdown = stats.outgoing_by_status;
        // Filter calls for performance calculation
        if (allCalls.length > 0) {
          filteredCalls = allCalls.filter(call => call.direction === 'outgoing');
        }
        break;
      default:
        callCount = stats.summary.total_calls;
        answeredCount = stats.summary.answered_calls;
        statusBreakdown = stats.status_breakdown;
        filteredCalls = allCalls;
        break;
    }
    
    // Calculate performance metrics from filtered calls or use backend data
    const calculatePerformanceMetrics = (calls: ExtensionCall[]) => {
      if (calls.length === 0 || viewMode === 'total') {
        // For total view, use backend calculated metrics
        return stats.performance;
      }
      
      // Calculate metrics for filtered calls
      // Note: Backend returns duration as 0, but has answered_at and ended_at times
      const answeredCalls = calls.filter(call => 
        (call.status === 'completed' || call.status === 'answered') && 
        call.answered_at && call.ended_at
      );
      
      if (answeredCalls.length === 0) {
        return {
          average_ring_time: stats.performance.average_ring_time,
          average_talk_time: 0,
          total_talk_time: 0
        };
      }
      
      // Calculate talk time from actual timestamps since duration is 0
      const totalTalkTime = answeredCalls.reduce((sum, call) => {
        if (call.answered_at && call.ended_at) {
          const startTime = new Date(call.answered_at).getTime();
          const endTime = new Date(call.ended_at).getTime();
          const duration = Math.max(0, Math.floor((endTime - startTime) / 1000));
          return sum + duration;
        }
        return sum;
      }, 0);
      
      const averageTalkTime = answeredCalls.length > 0 ? Math.round(totalTalkTime / answeredCalls.length) : 0;
      
      // For ring time, calculate from start to answer time
      const ringTimes = answeredCalls
        .filter(call => call.started_at && call.answered_at)
        .map(call => {
          const startTime = new Date(call.started_at).getTime();
          const answerTime = new Date(call.answered_at).getTime();
          return Math.max(0, Math.floor((answerTime - startTime) / 1000));
        });
      
      const averageRingTime = ringTimes.length > 0 
        ? Math.round(ringTimes.reduce((sum, time) => sum + time, 0) / ringTimes.length) 
        : stats.performance.average_ring_time;
      
      return {
        average_ring_time: averageRingTime,
        average_talk_time: averageTalkTime,
        total_talk_time: totalTalkTime
      };
    };
    
    const answerRate = callCount > 0 ? Number(((answeredCount / callCount) * 100).toFixed(2)) : 0;
    const performanceMetrics = calculatePerformanceMetrics(filteredCalls);
    
    return {
      total: callCount,
      answered: answeredCount,
      answerRate,
      statusBreakdown,
      performance: performanceMetrics
    };
  };

  const filteredStats = getFilteredStats();

  // Debug logging to see the actual data
  useEffect(() => {
    if (stats && isOpen) {
      console.log('📊 Extension Stats Data:', {
        stats,
        allCalls: allCalls.slice(0, 5), // Log first 5 calls
        viewMode,
        filteredStats
      });
    }
  }, [stats, allCalls, viewMode, filteredStats, isOpen]);

  // Fetch all calls when modal opens and we have stats
  useEffect(() => {
    if (isOpen && (stats?.extension || extensionNumber)) {
      fetchAllCalls();
    }
  }, [isOpen, stats?.extension, extensionNumber, stats?.period?.type]);

  // Reset status filter when view mode changes
  useEffect(() => {
    setStatusFilter('all');
  }, [viewMode]);

  if (!isOpen) return null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'answered':
      case 'completed':
        return <CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />;
      case 'busy':
        return <XCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />;
      case 'no_answer':
        return <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />;
      case 'canceled':
        return <XCircle className="h-3.5 w-3.5 text-gray-600 dark:text-gray-400" />;
      case 'congestion':
        return <AlertCircle className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />;
      default:
        return <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'answered':
      case 'completed':
        return 'text-emerald-600 dark:text-emerald-400';
      case 'busy':
        return 'text-rose-600 dark:text-rose-400';
      case 'no_answer':
        return 'text-amber-600 dark:text-amber-400';
      case 'canceled':
        return 'text-gray-600 dark:text-gray-400';
      case 'congestion':
        return 'text-orange-600 dark:text-orange-400';
      default:
        return 'text-blue-600 dark:text-blue-400';
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0.00s';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    // Always show seconds with 2 decimal places
    const secsDisplay = secs.toFixed(2);

    if (hours > 0) {
      return `${hours}h ${mins}m ${secsDisplay}s`;
    }
    return mins > 0 ? `${mins}m ${secsDisplay}s` : `${secsDisplay}s`;
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true
    });
  };

  // Get unique statuses from all calls for filter dropdown
  const getAvailableStatuses = () => {
    const filteredCalls = viewMode === 'total' ? allCalls : allCalls.filter(call => call.direction === viewMode);
    const statuses = [...new Set(filteredCalls.map(call => call.status))];
    return statuses.sort();
  };

  // Filter calls by status
  const getFilteredCalls = () => {
    let filteredCalls = viewMode === 'total' ? allCalls : allCalls.filter(call => call.direction === viewMode);
    
    if (statusFilter !== 'all') {
      filteredCalls = filteredCalls.filter(call => call.status === statusFilter);
    }
    
    return filteredCalls;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop with blur */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-4xl bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          
          {/* Header - Same style as ExtensionsStatus */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-linear-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-600 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Extension {stats?.extension || extensionNumber || '---'} Statistics
                    </h3>
                  </div>
                  {stats && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                      {stats.period.label}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">Loading statistics...</p>
                </div>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
                <p className="text-red-600 dark:text-red-400 text-sm font-medium">{error}</p>
              </div>
            ) : stats ? (
              <div className="space-y-6">
                
                {/* Top Stats Cards - Clickable */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  
                  {/* Total Calls - Clickable */}
                  <div 
                    className={`p-4 rounded-lg cursor-pointer transition-all ${
                      viewMode === 'total' 
                        ? 'bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-300 dark:border-blue-600' 
                        : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                    }`}
                    onClick={() => setViewMode('total')}
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <Phone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Total Calls</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                      {stats.summary.total_calls}
                    </p>
                  </div>
                  
                  {/* Incoming Calls - Clickable */}
                  <div 
                    className={`p-4 rounded-lg cursor-pointer transition-all ${
                      viewMode === 'incoming' 
                        ? 'bg-emerald-100 dark:bg-emerald-900/40 border-2 border-emerald-300 dark:border-emerald-600' 
                        : 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/30'
                    }`}
                    onClick={() => setViewMode('incoming')}
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <PhoneIncoming className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Incoming</span>
                    </div>
                    <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                      {stats.direction_breakdown.incoming}
                    </p>
                  </div>
                  
                  {/* Outgoing Calls - Clickable */}
                  <div 
                    className={`p-4 rounded-lg cursor-pointer transition-all ${
                      viewMode === 'outgoing' 
                        ? 'bg-violet-100 dark:bg-violet-900/40 border-2 border-violet-300 dark:border-violet-600' 
                        : 'bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-900/30'
                    }`}
                    onClick={() => setViewMode('outgoing')}
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <PhoneOutgoing className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                      <span className="text-xs font-medium text-violet-700 dark:text-violet-300">Outgoing</span>
                    </div>
                    <p className="text-2xl font-bold text-violet-900 dark:text-violet-100">
                      {stats.direction_breakdown.outgoing}
                    </p>
                  </div>
                  
                  {/* Answer Rate - Dynamic */}
                  <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 p-4 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                      <span className="text-xs font-medium text-orange-700 dark:text-orange-300">Answer Rate</span>
                    </div>
                    <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                      {(filteredStats?.answerRate || 0).toFixed(2)}%
                    </p>
                  </div>
                </div>

                {/* Second Row - Dynamic Cards Based on Selection */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* Left Card - Call Status Breakdown */}
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 p-3 rounded-lg">
                    <h4 className="text-sm font-semibold text-indigo-900 dark:text-indigo-100 mb-2 flex items-center">
                      <Activity className="h-4 w-4 mr-2" />
                      Call Status ({viewMode === 'total' ? 'All' : viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} Calls)
                    </h4>
                    <div className="space-y-1">
                      {Object.entries(filteredStats?.statusBreakdown || {}).map(([status, count]) => (
                        <div key={status} className="flex items-center justify-between py-1">
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(status)}
                            <span className={`text-xs capitalize ${getStatusColor(status)}`}>
                              {status.replace('_', ' ')}
                            </span>
                          </div>
                          <span className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">
                            {count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                   {/* Right Card - Performance Metrics */}
                   <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 p-3 rounded-lg">
                     <h4 className="text-sm font-semibold text-purple-900 dark:text-purple-100 mb-2 flex items-center">
                       <Timer className="h-4 w-4 mr-2" />
                       Performance Metrics ({viewMode === 'total' ? 'All' : viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} Calls)
                     </h4>
                     <div className="space-y-1">
                       <div className="flex justify-between py-1">
                         <span className="text-xs text-purple-700 dark:text-purple-300">Avg Ring Time</span>
                         <span className="text-sm font-semibold text-purple-900 dark:text-purple-100">
                           {formatDuration(filteredStats?.performance?.average_ring_time || 0)}
                         </span>
                       </div>
                       <div className="flex justify-between py-1">
                         <span className="text-xs text-purple-700 dark:text-purple-300">Avg Talk Time</span>
                         <span className="text-sm font-semibold text-purple-900 dark:text-purple-100">
                           {formatDuration(filteredStats?.performance?.average_talk_time || 0)}
                         </span>
                       </div>
                       <div className="flex justify-between py-1">
                         <span className="text-xs text-purple-700 dark:text-purple-300">Total Talk Time</span>
                         <span className="text-sm font-semibold text-purple-900 dark:text-purple-100">
                           {formatDuration(filteredStats?.performance?.total_talk_time || 0)}
                         </span>
                       </div>
                     </div>
                   </div>
                </div>

                {/* All Calls List */}
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg overflow-hidden">
                  <div 
                    className="p-4 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                    onClick={() => setShowAllCalls(!showAllCalls)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <List className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                         <h4 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                           {viewMode === 'total' ? 'All Calls' : `${viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} Calls`} ({
                             getFilteredCalls().length
                           } {statusFilter !== 'all' ? `${statusFilter} calls` : 'total'})
                         </h4>
                      </div>
                      <ChevronDown className={`h-4 w-4 text-emerald-600 dark:text-emerald-400 transition-transform ${
                        showAllCalls ? 'rotate-180' : ''
                      }`} />
                    </div>
                    {!showAllCalls && (
                      <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                        Click to view complete call history
                      </p>
                    )}
                  </div>
                  
                  {showAllCalls && (
                    <div className="border-t border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-900/10">
                      {loadingCalls ? (
                        <div className="p-6 text-center">
                          <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                          <p className="text-emerald-700 dark:text-emerald-300 text-sm">Loading all calls...</p>
                        </div>
                      ) : callsError ? (
                        <div className="p-6 text-center">
                          <p className="text-red-600 dark:text-red-400 text-sm">{callsError}</p>
                        </div>
                      ) : allCalls.length > 0 ? (
                        <div className="p-4">
                           {/* Status Filter */}
                           <div className="mb-4 flex items-center space-x-3">
                             <div className="flex items-center space-x-2">
                               <Filter className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                               <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Filter by Status:</span>
                             </div>
                             <select
                               value={statusFilter}
                               onChange={(e) => setStatusFilter(e.target.value)}
                               className="text-sm border border-emerald-300 dark:border-emerald-600 bg-white dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-100 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-[200px]"
                             >
                               <option value="all">All Statuses ({viewMode === 'total' ? allCalls.length : allCalls.filter(call => call.direction === viewMode).length})</option>
                               {getAvailableStatuses().map(status => {
                                 const count = (viewMode === 'total' ? allCalls : allCalls.filter(call => call.direction === viewMode))
                                   .filter(call => call.status === status).length;
                                 return (
                                   <option key={status} value={status}>
                                     {status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1)} ({count})
                                   </option>
                                 );
                               })}
                             </select>
                           </div>
                           
                           <div className="space-y-2 max-h-96 overflow-y-auto">
                             {getFilteredCalls().map((call, index) => (
                               <div key={call.id || index} className="flex items-center justify-between py-2 px-3 bg-emerald-50 dark:bg-emerald-800/20 rounded text-sm border border-emerald-100 dark:border-emerald-700">
                                 <div className="flex items-center space-x-2 flex-1 min-w-0">
                                   {getStatusIcon(call.status)}
                                   <div className="flex-1 min-w-0">
                                     <p className="font-medium text-emerald-900 dark:text-emerald-100 truncate">
                                       {call.other_party || 'Unknown'}
                                     </p>
                                     <div className="flex items-center space-x-1 mt-0.5">
                                       <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                         call.direction === 'incoming' 
                                           ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' 
                                           : 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                                       }`}>
                                         {call.direction === 'incoming' ? 'Incoming' : 'Outgoing'}
                                       </span>
                                       <span className={`px-1.5 py-0.5 rounded text-xs font-medium capitalize ${getStatusColor(call.status)}`}>
                                         {call.status.replace('_', ' ')}
                                       </span>
                                     </div>
                                   </div>
                                 </div>
                                 <div className="text-right text-xs shrink-0 ml-2">
                                   <p className="text-emerald-900 dark:text-emerald-100 font-medium">
                                     {formatTime(call.started_at)}
                                   </p>
                                   {call.duration > 0 && (
                                     <p className="text-emerald-700 dark:text-emerald-300">
                                       {formatDuration(call.duration)}
                                     </p>
                                   )}
                                 </div>
                               </div>
                             ))}
                           </div>
                        </div>
                      ) : (
                        <div className="p-6 text-center">
                          <p className="text-emerald-700 dark:text-emerald-300 text-sm">No calls found</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExtensionStatsModal;