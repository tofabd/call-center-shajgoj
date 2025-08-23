import React, { useEffect, useState } from 'react';
import { ShoppingBag, Clock, User, Hash, X, PhoneOutgoing, PhoneIncoming } from 'lucide-react';
import { callLogService, type CallDetails as ApiCallDetails } from '@services/callLogService';

interface CallDetailsProps {
  selectedCallId: number | null;
  isOpen: boolean;
  onClose: () => void;
  isManualSelection: boolean; // New prop to distinguish manual vs auto selection
}

export type { CallDetailsProps };

const CallDetails: React.FC<CallDetailsProps> = ({ selectedCallId, isOpen, onClose, isManualSelection }) => {
  const [details, setDetails] = useState<ApiCallDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const formatDuration = (totalSeconds: number): string => {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;
    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || (hours === 0 && minutes === 0)) parts.push(`${seconds}s`);
    return parts.join(' ');
  };

  const formatDateTime = (value?: string | null): string => {
    if (!value) return '-';
    const date = new Date(value);
    return date.toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  // Handle modal open/close animations
  useEffect(() => {
    if (isOpen) {
      // Start animation immediately when modal opens
      setIsAnimating(true);
      // Use a minimal delay for the smoothest possible animation
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 10); // Very short delay for immediate visual feedback
      
      return () => clearTimeout(timer);
    }
    // Note: We don't reset isAnimating on close to allow for smooth exit animation
  }, [isOpen]);

  // Handle modal close animation
  const handleClose = () => {
    setIsAnimating(true);
    // Wait for exit animation to complete before calling onClose
    setTimeout(() => {
      onClose();
    }, 200); // Match the transition duration
  };

  // Close modal when Escape key is pressed
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Reset data when modal opens with new call - ONLY for manual selection
  useEffect(() => {
    if (isOpen && selectedCallId && isManualSelection) {
      setDetails(null);
      setError(null);
      setLoading(true);
      
      // Wait for modal animation to complete before loading data
      const timer = setTimeout(() => {
        callLogService
          .getCallDetails(selectedCallId)
          .then((d) => {
            setDetails(d);
          })
          .catch(() => {
            setError('Failed to load call details');
          })
          .finally(() => {
            setLoading(false);
          });
      }, 250); // Increased delay to match animation duration

      return () => clearTimeout(timer);
    }
  }, [selectedCallId, isOpen, isManualSelection]);

  // Listen for real-time call status updates - ONLY for manually selected calls
  useEffect(() => {
    if (!selectedCallId || !window.Echo || !isManualSelection) return;

    console.log('🔔 CallDetails: Setting up Echo listener for manually selected call ID:', selectedCallId);
    
    const channel = window.Echo.channel('call-console');
    
    const handleCallUpdate = (data: { id: number; status: string; duration?: number; [key: string]: unknown }) => {
      console.log('🔔 CallDetails: Received real-time update:', data);
      
      // Only update if this update is for the currently selected call
      if (data.id === selectedCallId) {
        console.log('✅ CallDetails: Updating details for manually selected call');
        
        // Refresh the call details from the server to get the latest data
        callLogService
          .getCallDetails(selectedCallId)
          .then((updatedDetails) => {
            setDetails(updatedDetails);
            console.log('🔄 CallDetails: Updated with fresh data from server');
          })
          .catch((error) => {
            console.error('❌ CallDetails: Failed to refresh call details:', error);
          });
      }
    };

    channel.listen('.call-updated', handleCallUpdate);

    return () => {
      console.log('🧹 CallDetails: Cleaning up Echo listener');
      // Note: We don't leave the channel as other components might be using it
    };
  }, [selectedCallId, isManualSelection]);

  // Don't render if modal is not open
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/50 z-40 transition-all duration-200 ease-out ${
          isAnimating ? 'opacity-0' : 'opacity-100'
        }`}
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div 
          className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col transition-all duration-200 ease-out transform ${
            isAnimating 
              ? 'opacity-0 scale-95 translate-y-2' 
              : 'opacity-100 scale-100 translate-y-0'
          }`}
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-gray-800 dark:to-gray-700 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-600 rounded-lg">
                <ShoppingBag className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Call Details</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedCallId && isManualSelection ? 'Details for selected call' : 'Select a call to view details'}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className={`flex-1 min-h-0 overflow-y-auto narrow-scrollbar transition-all duration-300 ease-out ${
            isAnimating ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
          }`}>
            {!selectedCallId || !isManualSelection ? (
              <div className="p-8 flex items-center justify-center h-full">
                <div className="text-center">
                  <h4 className="text-gray-900 dark:text-white font-medium text-lg mb-2">No Call Selected</h4>
                  <p className="text-gray-500 dark:text-gray-400">
                    {!isManualSelection 
                      ? 'Click on a call to manually select and view details' 
                      : 'Select a call from the Live Calls or Call Monitor to view details'
                    }
                  </p>
                </div>
              </div>
            ) : loading ? (
              <div className="p-6">
                <div className="w-full space-y-6">
                  {/* Summary banner skeleton */}
                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 mb-6">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="h-6 w-20 bg-gray-300 dark:bg-gray-600 rounded-full animate-pulse"></div>
                        <div className="h-7 w-32 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                        <div className="h-5 w-24 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-28 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                        <div className="h-4 w-24 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                      </div>
                    </div>
                  </div>

                  {/* Call Flow Steps skeleton */}
                  <div className="space-y-4">
                    <div className="h-6 w-32 bg-gray-300 dark:bg-gray-600 rounded mb-4 animate-pulse"></div>
                    
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 shadow-sm">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded-full animate-pulse"></div>
                            <div className="h-4 w-48 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                          </div>
                          <div className="h-5 w-20 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {[...Array(6)].map((_, j) => (
                            <div key={j} className="space-y-1">
                              <div className="h-3 w-16 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                              <div className="h-3 w-24 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : error ? (
              <div className="p-8 flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-red-600 dark:text-red-400 text-sm font-medium">{error}</p>
                </div>
              </div>
            ) : (
              <div className="p-6">
                <div className="w-full space-y-6">
                                                        {/* Summary banner */}
                    {details && (
                      <div className="relative rounded-2xl border border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/30 dark:via-indigo-900/30 dark:to-purple-900/30 p-6 shadow-lg shadow-blue-100/50 dark:shadow-blue-900/20 mb-8 overflow-hidden">
                        {/* Background Pattern */}
                        <div className="absolute inset-0 opacity-5">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-200 rounded-full translate-x-16 -translate-y-16"></div>
                          <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-200 rounded-full -translate-x-12 translate-y-12"></div>
                          <div className="absolute top-1/2 right-1/3 w-16 h-16 bg-purple-200 rounded-full opacity-30"></div>
                        </div>
                        
                        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                          <div className="space-y-3">
                                                         <div className="flex items-center gap-3 flex-wrap">
                               <span className={`px-4 py-2 text-sm rounded-full font-bold text-white shadow-sm flex items-center gap-2 ${
                                 details.direction === 'outgoing' ? 'bg-gradient-to-r from-blue-500 to-blue-600' :
                                 details.direction === 'incoming' ? 'bg-gradient-to-r from-emerald-500 to-teal-600' :
                                 'bg-gradient-to-r from-gray-500 to-slate-600'
                               }`}>
                                 {details.direction === 'outgoing' ? (
                                   <PhoneOutgoing className="w-4 h-4" />
                                 ) : details.direction === 'incoming' ? (
                                   <PhoneIncoming className="w-4 h-4" />
                                 ) : (
                                   <span>📞</span>
                                 )}
                                 {details.direction ? details.direction.charAt(0).toUpperCase() + details.direction.slice(1) : 'Unknown'}
                               </span>
                              <span className="text-2xl font-bold text-gray-800 dark:text-gray-100 font-mono">{details.callerNumber || 'Unknown number'}</span>
                              {details.agentExten || details.extension ? (
                                <span className="text-gray-700 dark:text-gray-300 text-lg">→ Ext <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{details.agentExten || details.extension}</span></span>
                              ) : null}
                              {details.otherParty || details.connectedLineNum ? (
                                <span className="text-gray-700 dark:text-gray-300 text-lg">with <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{details.otherParty || details.connectedLineNum}</span></span>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-4 text-gray-600 dark:text-gray-400 text-base flex-wrap">
                              <span className="flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                Started: <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">{formatDateTime(details.startTime)}</span>
                              </span>
                              {typeof details.duration === 'number' && (
                                <>
                                  <span className="text-gray-400">•</span>
                                  <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                                    Duration: <span className="font-mono font-semibold text-green-600 dark:text-green-400">{formatDuration(details.duration)}</span>
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`px-4 py-2 text-base rounded-full font-bold text-white shadow-sm ${
                              (details.status || '').toLowerCase() === 'answered' ? 'bg-gradient-to-r from-emerald-500 to-green-600' :
                              (details.status || '').toLowerCase() === 'busy' ? 'bg-gradient-to-r from-rose-500 to-red-600' :
                              (details.status || '').toLowerCase().includes('ring') ? 'bg-gradient-to-r from-blue-500 to-cyan-600 animate-pulse' :
                              (details.status || '').toLowerCase() === 'started' ? 'bg-gradient-to-r from-violet-500 to-purple-600' :
                              'bg-gradient-to-r from-gray-500 to-slate-600'
                            }`}>
                              {details.status || 'Unknown'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                                                                           {/* Call Flow Steps */}
                    {details && details.callFlow && (
                      <div className="space-y-5">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center">
                            <Hash className="w-4 h-4 text-white" />
                          </div>
                          <h4 className="text-xl font-bold text-gray-800 dark:text-gray-100">Call Flow Journey</h4>
                        </div>
                        
                        {details.callFlow.map((step, index) => (
                          <div key={step.uniqueid || index} className={`relative rounded-xl p-5 shadow-md border-l-4 transition-all duration-300 hover:shadow-lg ${
                            step.step_type === 'master_channel' ? 'bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/10 dark:to-violet-900/10 border-l-purple-400' :
                            step.step_type === 'queue_handling' ? 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 border-l-amber-400' :
                            step.step_type === 'agent_connection' ? 'bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/10 dark:to-teal-900/10 border-l-emerald-400' :
                            step.step_type === 'trunk_connection' ? 'bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/10 dark:to-blue-900/10 border-l-cyan-400' :
                            'bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900/10 dark:to-gray-900/10 border-l-slate-400'
                          }`}>
                            {/* Step Number Badge */}
                            <div className="absolute -top-2 -left-2">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md ${
                                step.step_type === 'master_channel' ? 'bg-purple-500' :
                                step.step_type === 'queue_handling' ? 'bg-amber-500' :
                                step.step_type === 'agent_connection' ? 'bg-emerald-500' :
                                step.step_type === 'trunk_connection' ? 'bg-cyan-500' :
                                'bg-slate-500'
                              }`}>
                                {index + 1}
                              </div>
                            </div>
                            
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-center gap-3 flex-1">
                                <span className={`px-3 py-1 text-xs font-semibold rounded-full text-white ${
                                  step.step_type === 'master_channel' ? 'bg-purple-500' :
                                  step.step_type === 'queue_handling' ? 'bg-amber-500' :
                                  step.step_type === 'agent_connection' ? 'bg-emerald-500' :
                                  step.step_type === 'trunk_connection' ? 'bg-cyan-500' :
                                  'bg-slate-500'
                                }`}>
                                    {step.step_type?.replace('_', ' ').toUpperCase()}
                                  </span>
                                <span className="text-base font-semibold text-gray-800 dark:text-gray-100">
                                  {step.step_description}
                                </span>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                              <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                <span className="text-gray-600 dark:text-gray-300 font-medium">Channel:</span>
                                <span className="ml-2 font-mono text-xs break-all text-gray-800 dark:text-gray-100">{step.channel || '-'}</span>
                              </div>
                              <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                <span className="text-gray-600 dark:text-gray-300 font-medium">Extension:</span>
                                <span className="ml-2 font-mono text-xs text-gray-800 dark:text-gray-100">{step.exten || '-'}</span>
                              </div>
                              <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                <span className="text-gray-600 dark:text-gray-300 font-medium">Context:</span>
                                <span className="ml-2 font-mono text-xs text-gray-800 dark:text-gray-100">{step.context || '-'}</span>
                              </div>
                              <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                <span className="text-gray-600 dark:text-gray-300 font-medium">State:</span>
                                <span className="ml-2 font-mono text-xs text-gray-800 dark:text-gray-100">{step.channel_state_desc || step.channel_state || '-'}</span>
                              </div>
                              <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                <span className="text-gray-600 dark:text-gray-300 font-medium">Start Time:</span>
                                <span className="ml-2 font-mono text-xs text-gray-800 dark:text-gray-100">{formatDateTime(step.start_time)}</span>
                              </div>
                              {step.answer_at && (
                                <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                  <span className="text-gray-600 dark:text-gray-300 font-medium">Answered:</span>
                                  <span className="ml-2 font-mono text-xs text-gray-800 dark:text-gray-100">{formatDateTime(step.answer_at)}</span>
                                </div>
                              )}
                              {step.hangup_at && (
                                <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                  <span className="text-gray-600 dark:text-gray-300 font-medium">Hangup:</span>
                                  <span className="ml-2 font-mono text-xs text-gray-800 dark:text-gray-100">{formatDateTime(step.hangup_at)}</span>
                                </div>
                              )}
                              {step.hangup_cause && (
                                <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                  <span className="text-gray-600 dark:text-gray-300 font-medium">Hangup Cause:</span>
                                  <span className="ml-2 font-mono text-xs text-gray-800 dark:text-gray-100">{step.hangup_cause}</span>
                                </div>
                              )}
                            </div>
                            
                            {step.callerid_num && (
                              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <div className="text-xs text-gray-600 dark:text-gray-300 mb-2 font-medium">Caller ID:</div>
                                <div className="font-mono text-sm bg-white/80 dark:bg-gray-800/80 rounded-lg p-2 text-gray-800 dark:text-gray-100">{step.callerid_num} {step.callerid_name ? `(${step.callerid_name})` : ''}</div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                                                                           {/* Extension Changes for Incoming Calls */}
                    {details && details.direction === 'incoming' && details.extensionChanges && details.extensionChanges.length > 0 && (
                      <div className="space-y-5 mt-8">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center">
                            <Clock className="w-4 h-4 text-white" />
                          </div>
                          <h4 className="text-xl font-bold text-gray-800 dark:text-gray-100">Extension Routing Changes</h4>
                        </div>
                        
                        {details.extensionChanges.map((change, index) => (
                          <div key={index} className="relative rounded-xl p-5 shadow-md border-l-4 border-l-amber-400 bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-900/10 dark:via-orange-900/10 dark:to-yellow-900/10 transition-all duration-300 hover:shadow-lg">
                            {/* Change Number Badge */}
                            <div className="absolute -top-2 -left-2">
                              <div className="w-7 h-7 bg-amber-500 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md">
                                {index + 1}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3 mb-4">
                              <span className="px-3 py-1 text-xs font-semibold rounded-full text-white bg-amber-500">
                                🔄 Extension Change
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                              <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                <span className="text-gray-700 dark:text-gray-200 font-medium">⏰ Time:</span>
                                <span className="ml-2 font-mono text-xs text-gray-800 dark:text-gray-100">{formatDateTime(change.time)}</span>
                              </div>
                              <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                <span className="text-gray-700 dark:text-gray-200 font-medium">📤 From:</span>
                                <span className="ml-2 font-mono text-xs text-gray-800 dark:text-gray-100">{change.from_extension || 'Initial'}</span>
                              </div>
                              <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                <span className="text-gray-700 dark:text-gray-200 font-medium">📥 To:</span>
                                <span className="ml-2 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">{change.to_extension}</span>
                              </div>
                              <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                <span className="text-gray-700 dark:text-gray-200 font-medium">🌐 Context:</span>
                                <span className="ml-2 font-mono text-xs text-gray-800 dark:text-gray-100">{change.context || '-'}</span>
                              </div>
                              <div className="md:col-span-2 bg-white/70 dark:bg-gray-800/70 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                <span className="text-gray-700 dark:text-gray-200 font-medium">💡 Reason:</span>
                                <span className="ml-2 text-xs text-gray-800 dark:text-gray-100">{change.reason}</span>
                              </div>
                              <div className="md:col-span-2 bg-white/70 dark:bg-gray-800/70 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                <span className="text-gray-700 dark:text-gray-200 font-medium">📞 Channel:</span>
                                <span className="ml-2 font-mono text-xs break-all text-gray-800 dark:text-gray-100">{change.channel || '-'}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                                                                           {/* Basic Call Information */}
                    {details && (
                      <div className="space-y-4 mt-8">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-8 h-8 bg-gradient-to-br from-slate-400 to-gray-500 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-white" />
                          </div>
                          <h4 className="text-xl font-bold text-gray-800 dark:text-gray-100">Call Information</h4>
                        </div>
                        
                        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900/10 dark:to-gray-900/10 p-5 shadow-md">
                          <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div className="bg-white/80 dark:bg-gray-800/80 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                              <dt className="text-slate-600 dark:text-slate-300 font-medium mb-1">🆔 Call ID</dt>
                              <dd className="font-mono text-sm text-slate-800 dark:text-slate-100 font-semibold">{details.id}</dd>
                            </div>
                            <div className="bg-white/80 dark:bg-gray-800/80 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                              <dt className="text-slate-600 dark:text-slate-300 font-medium mb-1">🔑 Unique ID</dt>
                              <dd className="font-mono text-xs break-all text-slate-800 dark:text-slate-100">{details.uniqueid || '-'}</dd>
                            </div>
                            <div className="bg-white/80 dark:bg-gray-800/80 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                              <dt className="text-slate-600 dark:text-slate-300 font-medium mb-1">🔗 Linked ID</dt>
                              <dd className="font-mono text-xs break-all text-slate-800 dark:text-slate-100">{details.linkedid || '-'}</dd>
                            </div>
                            <div className="bg-white/80 dark:bg-gray-800/80 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                              <dt className="text-slate-600 dark:text-slate-300 font-medium mb-1">📡 Direction</dt>
                              <dd className="capitalize text-sm text-slate-800 dark:text-slate-100 font-semibold">{details.direction || '-'}</dd>
                            </div>
                            <div className="bg-white/80 dark:bg-gray-800/80 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                              <dt className="text-slate-600 dark:text-slate-300 font-medium mb-1">📊 Status</dt>
                              <dd className="text-sm text-slate-800 dark:text-slate-100">{details.status || '-'}</dd>
                            </div>
                            <div className="bg-white/80 dark:bg-gray-800/80 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                              <dt className="text-slate-600 dark:text-slate-300 font-medium mb-1">⏱️ Duration</dt>
                              <dd className="font-mono text-sm text-slate-800 dark:text-slate-100 font-semibold">{typeof details.duration === 'number' ? formatDuration(details.duration) : '-'}</dd>
                            </div>
                            <div className="bg-white/80 dark:bg-gray-800/80 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                              <dt className="text-slate-600 dark:text-slate-300 font-medium mb-1">📅 Created</dt>
                              <dd className="font-mono text-xs text-slate-800 dark:text-slate-100">{formatDateTime(details.createdAt)}</dd>
                            </div>
                            <div className="bg-white/80 dark:bg-gray-800/80 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                              <dt className="text-slate-600 dark:text-slate-300 font-medium mb-1">🔄 Updated</dt>
                              <dd className="font-mono text-xs text-slate-800 dark:text-slate-100">{formatDateTime(details.updatedAt)}</dd>
                            </div>
                          </dl>
                        </div>
                      </div>
                    )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default CallDetails;
