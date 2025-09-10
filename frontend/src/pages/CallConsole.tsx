import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';

import { callLogService } from '@services/callLogService';
import type { CallLog } from '@services/callLogService';
import callRealtimeService, { type CallUpdate } from '@services/callRealtimeService';
import CallHistory from '@/components/CallConsole/CallHistory';
import LiveCalls from '@/components/CallConsole/LiveCalls';
import CallDetails from '@/components/CallConsole/CallDetailsModal';
import ExtensionsStatus from '@/components/CallConsole/ExtensionsStatus';

// Real-time interface for Laravel API
// interface CallStatusUpdateData {
//   id: number;
//   callerNumber: string;
//   callerName: string | null;
//   startTime: string;
//   endTime?: string;
//   status: string;
//   duration?: number;
//   exten?: string;
//   timestamp: string;
//   direction?: 'incoming' | 'outgoing';
//   agentExten?: string | null;
//   otherParty?: string | null;
// }

// Removed WordPress/WooCommerce-specific interfaces

const CallConsole: React.FC = () => {
  const [callLogs, setCallLogs] = useState<CallLog[]>([]); // Changed to CallLog[] for individual calls
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [isCallDetailsModalOpen, setIsCallDetailsModalOpen] = useState(false);
  const [isManualSelection, setIsManualSelection] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'live' | 'extensions'>('history');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isHistoryRefreshing, setIsHistoryRefreshing] = useState(false);
  // Removed WooCommerce modal states
  // Removed WooCommerce notes states

  // Refs for cleanup  
  const isMountedRef = useRef(true);

  const fetchData = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) {
        setLoading(true);
      }
      setError(null);
      console.log('🚀 Fetching call data from Laravel API...');
      
      const logs = await callLogService.getCallLogs();
      console.log('📊 Received call data:', logs);
      
      // Sort calls by start time (most recent first)
      const sortedLogs = logs.sort((a, b) => 
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );
      
      console.log('🔄 Setting call logs:', sortedLogs.length, 'individual calls');
      setCallLogs(sortedLogs);
    } catch (err) {
      console.error('❌ Error fetching call data:', err);
      setError('Failed to fetch call data from Laravel API');
      setCallLogs([]);
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  }, []);

  // Real-time Echo setup for call updates
  useEffect(() => {
    isMountedRef.current = true;
    
    // Initial fetch
    fetchData(true);
    
    // Set up real-time call updates via Echo
    const unsubscribe = callRealtimeService.subscribeToAll((callUpdate: CallUpdate) => {
      console.log('🔔 Received real-time call update:', callUpdate);
      
      if (!isMountedRef.current) return;
      
      // Update the specific call in the list or add new one
      setCallLogs(prevLogs => {
        const callId = String(callUpdate.id);
        const existingIndex = prevLogs.findIndex(call => call.id === callId);
        
        if (existingIndex >= 0) {
          // Update existing call
          const updatedLogs = [...prevLogs];
          updatedLogs[existingIndex] = {
            ...updatedLogs[existingIndex],
            callerNumber: callUpdate.callerNumber || updatedLogs[existingIndex].callerNumber,
            callerName: callUpdate.callerName || updatedLogs[existingIndex].callerName,
            status: callUpdate.status || updatedLogs[existingIndex].status,
            duration: callUpdate.duration ?? updatedLogs[existingIndex].duration,
            endTime: callUpdate.endTime || updatedLogs[existingIndex].endTime,
            direction: callUpdate.direction || updatedLogs[existingIndex].direction,
            agentExten: callUpdate.agentExten || updatedLogs[existingIndex].agentExten,
            otherParty: callUpdate.otherParty || updatedLogs[existingIndex].otherParty
          };
          
          console.log('✅ Updated existing call:', callId);
          return updatedLogs;
        } else {
          // Add new call if it doesn't exist
          const newCall: CallLog = {
            id: callId,
            callerNumber: callUpdate.callerNumber || callUpdate.otherParty || 'Unknown',
            callerName: callUpdate.callerName,
            startTime: callUpdate.startTime || new Date().toISOString(),
            endTime: callUpdate.endTime,
            status: callUpdate.status || 'unknown',
            duration: callUpdate.duration,
            direction: callUpdate.direction,
            agentExten: callUpdate.agentExten,
            otherParty: callUpdate.otherParty
          };
          
          console.log('➕ Added new call:', callId);
          // Add to beginning and sort by start time
          const updatedLogs = [newCall, ...prevLogs].sort((a, b) => 
            new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
          );
          return updatedLogs;
        }
      });
    });
    
    console.log('📡 CallConsole: Echo real-time updates enabled');

    // Handle page visibility changes
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      
      if (isVisible) {
        console.log('📱 CallConsole page became visible, refreshing data...');
        fetchData(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Cleanup function
    return () => {
      isMountedRef.current = false;
      unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      console.log('🧹 CallConsole: Stopped real-time updates');
    };
  }, [fetchData]);

  // Debug useEffect to monitor selection
  useEffect(() => {
    if (selectedCallId) {
      console.log('🔍 Call selected:', selectedCallId, 'Manual:', isManualSelection);
    }
  }, [selectedCallId, isManualSelection]);

  // Real-time Echo listener for Laravel API
  // Set up real-time Echo listener for call updates (no auto-selection)
  // useEffect(() => {
  //   if (window.Echo) {
  //     console.log('🚀 Setting up Echo listener for call-console channel');
  //     setEchoConnected(true);
      
  //     // Listen to the public call-console channel for call status updates
  //     const channel = window.Echo.channel('call-console');
      
  //     // Clean call-level updates from the clean calls pipeline
  //     channel.listen('.call-updated', (data: CallStatusUpdateData) => {
  //       console.log('🔔 Received call-updated (clean) event:', data);
  //       setCallLogs(prevLogs => {
  //         const idx = prevLogs.findIndex(c => c.id === data.id);
  //         if (idx >= 0) {
  //           const updated = [...prevLogs];
  //           const existing = updated[idx];
  //           existing.status = data.status;
  //           existing.duration = data.duration;
  //           existing.startTime = data.startTime;
  //           existing.callerNumber = data.callerNumber;
  //           existing.callerName = data.callerName ?? null;
  //           if (data.direction !== undefined) existing.direction = data.direction;
  //           if (data.agentExten !== undefined) existing.agentExten = data.agentExten ?? null;
  //           if (data.otherParty !== undefined) existing.otherParty = data.otherParty ?? null;
  //           existing.allCalls[0] = {
  //             id: data.id,
  //             callerNumber: data.callerNumber,
  //             callerName: data.callerName,
  //             startTime: data.startTime,
  //             endTime: data.endTime,
  //             status: data.status,
  //             duration: data.duration,
  //             created_at: data.timestamp,
  //           };
  //           return updated;
  //         } else {
  //           const newItem: UniqueCall = {
  //             id: data.id,
  //             callerNumber: data.callerNumber,
  //             callerName: data.callerName,
  //             startTime: data.startTime,
  //             status: data.status,
  //             duration: data.duration,
  //             frequency: 1,
  //             allCalls: [{
  //               id: data.id,
  //             callerNumber: data.callerNumber,
  //             callerName: data.callerName,
  //             startTime: data.startTime,
  //             endTime: data.endTime,
  //             status: data.status,
  //             duration: data.duration,
  //             created_at: data.timestamp,
  //           }],
  //             direction: data.direction,
  //             agentExten: data.agentExten ?? null,
  //             otherParty: data.otherParty ?? null,
  //           };
  //           return [newItem, ...prevLogs];
  //         }
  //       });
  //       // Removed auto-selection - calls are only selected manually now
  //     });

  //     // Test the connection
  //     console.log('📡 Echo channel setup complete, testing connection...');

  //     // Cleanup function
  //     return () => {
  //       console.log('🧹 Cleaning up Echo listener');
  //       window.Echo.leaveChannel('call-console');
  //       setEchoConnected(false);
  //     };
  //   } else {
  //     console.warn('⚠️ Window.Echo is not available');
  //     setEchoConnected(false);
  //   }
  // }, []);

  // Customer profile integration removed

  // Orders and notes queries removed

  // Manual refresh for CallHistory
  const handleManualRefresh = useCallback(async () => {
    console.log('🔄 Manual refresh triggered for CallHistory');
    setIsHistoryRefreshing(true);
    try {
      await fetchData(false);
    } finally {
      setTimeout(() => {
        setIsHistoryRefreshing(false);
      }, 1000); // Keep spinning for visual feedback
    }
  }, [fetchData]);

  // Handle call completion events from CallHistory real-time subscription
  const handleCallCompleted = useCallback((completedCall: any) => {
    console.log('📞 Call completed, adding to history:', completedCall);
    
    setCallLogs(prevLogs => {
      // Check if call already exists in history
      const existingIndex = prevLogs.findIndex(call => call.id === completedCall.id);
      
      if (existingIndex >= 0) {
        // Update existing call with completion data
        const updatedLogs = [...prevLogs];
        updatedLogs[existingIndex] = {
          ...updatedLogs[existingIndex],
          endTime: completedCall.endTime,
          status: completedCall.status,
          duration: completedCall.duration,
          disposition: completedCall.disposition
        };
        
        console.log('✅ Updated completed call in history:', completedCall.id);
        return updatedLogs.sort((a, b) => 
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        );
      } else {
        // Add new completed call to history
        const newCall: CallLog = {
          id: completedCall.id,
          callerNumber: completedCall.callerNumber,
          callerName: completedCall.callerName,
          startTime: completedCall.startTime,
          endTime: completedCall.endTime,
          status: completedCall.status,
          duration: completedCall.duration,
          direction: completedCall.direction,
          agentExten: completedCall.agentExten,
          otherParty: completedCall.otherParty,
          created_at: completedCall.created_at,
          disposition: completedCall.disposition
        };
        
        console.log('➕ Added new completed call to history:', completedCall.id);
        return [newCall, ...prevLogs].sort((a, b) => 
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        );
      }
    });
  }, []);

  // Function to handle call selection
  const handleCallSelect = async (callId: string) => {
    if (selectedCallId === callId) {
      // If same call is clicked, deselect it
      setSelectedCallId(null);
      setIsCallDetailsModalOpen(false);
      setIsManualSelection(false);
      return;
    }

    setSelectedCallId(callId);
    setIsManualSelection(true); // Mark as manual selection
    setIsCallDetailsModalOpen(true);
    
    // Customer profile integration removed
  };

  // Function to close call details modal
  const handleCloseCallDetailsModal = () => {
    setIsCallDetailsModalOpen(false);
    setSelectedCallId(null);
    setIsManualSelection(false);
  };

  // Customer selection removed

  // WooCommerce order handlers removed

  // Removed unused formatting helpers

  return (
    <Tooltip.Provider>
      <div className="bg-gray-50 dark:bg-gray-900 lg:h-[calc(100vh-4rem)]">
      {/* WooCommerce modals removed */}

      {/* Mobile Tab Navigation */}
      <div className="lg:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <nav className="flex">
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 px-4 text-sm font-medium text-center border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            Call History
          </button>
          <button
            onClick={() => setActiveTab('live')}
            className={`flex-1 py-3 px-4 text-sm font-medium text-center border-b-2 transition-colors ${
              activeTab === 'live'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            Live Calls
          </button>
          <button
            onClick={() => setActiveTab('extensions')}
            className={`flex-1 py-3 px-4 text-sm font-medium text-center border-b-2 transition-colors ${
              activeTab === 'extensions'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            Extensions
          </button>
        </nav>
      </div>

      {/* Mobile Tab Content */}
      <div className="lg:hidden h-[calc(100vh-8rem)] overflow-hidden">
        {activeTab === 'history' && (
          <div className="h-full">
            <CallHistory
              callLogs={callLogs}
              selectedCallId={selectedCallId}
              loading={loading}
              error={error}
              onCallSelect={handleCallSelect}
              onRefresh={handleManualRefresh}
              onCallCompleted={handleCallCompleted}
              isRefreshing={isHistoryRefreshing}
            />
          </div>
        )}
        {activeTab === 'live' && (
          <div className="h-full">
            <LiveCalls
              selectedCallId={selectedCallId}
              onCallSelect={handleCallSelect}
            />
          </div>
        )}
        {activeTab === 'extensions' && (
          <div className="h-full">
            <ExtensionsStatus />
          </div>
        )}
      </div>

      {/* Desktop: 3-column grid with 3:3:2 ratio */}
      <div className="hidden lg:grid lg:grid-cols-8 gap-4 p-4 lg:p-6 lg:h-full lg:overflow-hidden">
        {/* Call History - 3fr on desktop */}
        <div className="lg:col-span-3 min-w-0 min-h-0 flex flex-col">
          <CallHistory
            callLogs={callLogs} // Now passing individual calls
            selectedCallId={selectedCallId}
            loading={loading}
            error={error}
            onCallSelect={handleCallSelect}
            onRefresh={handleManualRefresh}
            onCallCompleted={handleCallCompleted}
            isRefreshing={isHistoryRefreshing}
          />
        </div>

        {/* Live Calls - 3fr on desktop */}
        <div className="lg:col-span-3 min-w-0 min-h-0 flex flex-col">
          <LiveCalls
            selectedCallId={selectedCallId}
            onCallSelect={handleCallSelect}
          />
        </div>

        {/* Extensions Status - 2fr on desktop */}
        <div className="lg:col-span-2 min-w-0 min-h-0 flex flex-col">
          <ExtensionsStatus />
        </div>
      </div>

      {/* Call Details Modal */}
      <CallDetails
        selectedCallId={selectedCallId}
        isOpen={isCallDetailsModalOpen}
        onClose={handleCloseCallDetailsModal}
        isManualSelection={isManualSelection}
      />
      </div>
    </Tooltip.Provider>
  );
};

export default CallConsole;