import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { callLogService } from '@services/callLogService';
import type { CallStats, CallLog } from '@services/callLogService';
// Removed WordPress/WooCommerce API imports
import '@services/echo'; // Import Echo setup
// Removed WooCommerce order modals
import CallMonitor from '@/components/CallConsole/CallMonitor';
import CallDetails from '@/components/CallConsole/CallDetails';
// Removed OrderNotesPanel
import CustomerProfile from '@/components/CallConsole/CustomerProfile';
import TodayStatistics from '@/components/CallConsole/TodayStatistics';

// Interface for call status update data from backend
interface CallStatusUpdateData {
  id: number;
  callerNumber: string;
  callerName: string | null;
  startTime: string;
  endTime?: string;
  status: string;
  duration?: number;
  exten?: string;
  timestamp: string;
  direction?: 'incoming' | 'outgoing';
  agentExten?: string | null;
  otherParty?: string | null;
}

// Removed WordPress/WooCommerce-specific interfaces

// Interface for unique call with frequency
interface UniqueCall {
  id: number;
  callerNumber: string;
  callerName: string | null;
  startTime: string;
  status: string;
  duration?: number;
  frequency: number;
  allCalls: Array<{
    id: number;
    callerNumber: string;
    callerName: string | null;
    startTime: string;
    endTime?: string;
    status: string;
    duration?: number;
    created_at: string;
  }>;
  direction?: 'incoming' | 'outgoing';
  agentExten?: string | null;
  otherParty?: string | null;
}

const CallConsole: React.FC = () => {
  const [callLogs, setCallLogs] = useState<UniqueCall[]>([]);
  const [callStats, setCallStats] = useState<CallStats | null>(null);
  const [selectedCallId, setSelectedCallId] = useState<number | null>(null);
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [echoConnected, setEchoConnected] = useState(false);
  // Removed WooCommerce modal states
  const [expandedCalls, setExpandedCalls] = useState<Set<string>>(new Set());
  // Removed WooCommerce notes states

  // Transform flat call logs into grouped unique calls for UI
  const transformToUniqueCalls = (logs: CallLog[]): UniqueCall[] => {
    // Backend already returns only master calls; map 1:1
    const mapped: UniqueCall[] = logs
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .map((c) => ({
        id: c.id,
        callerNumber: c.callerNumber,
        callerName: c.callerName ?? null,
        startTime: c.startTime,
        status: c.status,
        duration: c.duration,
        frequency: 1,
        allCalls: [{
          id: c.id,
          callerNumber: c.callerNumber,
          callerName: c.callerName ?? null,
          startTime: c.startTime,
          endTime: c.endTime,
          status: c.status,
          duration: c.duration,
          created_at: c.startTime,
        }],
        direction: c.direction,
        agentExten: c.agentExten ?? null,
        otherParty: c.otherParty ?? null,
      }));
    return mapped;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [logs, stats] = await Promise.all([
          callLogService.getCallLogs(),
          callLogService.getTodayStats()
        ]);
        setCallLogs(transformToUniqueCalls(logs));
        setCallStats(stats);
      } catch (err) {
        setError('Failed to fetch call data');
        console.error('Error fetching call data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Debug useEffect to monitor auto-selection
  useEffect(() => {
    if (selectedCallId) {
      console.log('🔍 Call selected:', selectedCallId, 'Phone:', selectedPhoneNumber);
    }
  }, [selectedCallId, selectedPhoneNumber]);

  // Set up real-time Echo listener for call updates with auto-selection
  useEffect(() => {
    if (window.Echo) {
      console.log('🚀 Setting up Echo listener for call-console channel');
      setEchoConnected(true);
      
      // Listen to the public call-console channel for call status updates
      const channel = window.Echo.channel('call-console');
      
      channel.listen('.call-status-updated', (data: CallStatusUpdateData) => {
        console.log('🔔 Received real-time call update:', data);
        
        // Auto-select statuses that should trigger automatic selection
        const autoSelectStatuses = ['ringing', 'started', 'answered', 'ring', 'start', 'calling', 'incoming'];
        const normalizedStatus = data.status.toLowerCase().trim();
        const shouldAutoSelect = autoSelectStatuses.includes(normalizedStatus);
        
        let isNewCall = false;
        
        // Update call logs in real-time
        setCallLogs(prevLogs => {
          const idx = prevLogs.findIndex(c => c.id === data.id);
          if (idx >= 0) {
            const updated = [...prevLogs];
            const existing = updated[idx];
            existing.status = data.status;
            existing.duration = data.duration;
            existing.startTime = data.startTime;
            existing.callerNumber = data.callerNumber;
            existing.callerName = data.callerName ?? null;
            // Ensure direction/agentExten/otherParty are kept in sync with realtime updates
            if (data.direction !== undefined) {
              existing.direction = data.direction;
            }
            if (data.agentExten !== undefined) {
              existing.agentExten = data.agentExten ?? null;
            }
            if (data.otherParty !== undefined) {
              existing.otherParty = data.otherParty ?? null;
            }
            existing.allCalls[0] = {
              id: data.id,
              callerNumber: data.callerNumber,
              callerName: data.callerName,
              startTime: data.startTime,
              endTime: data.endTime,
              status: data.status,
              duration: data.duration,
              created_at: data.timestamp,
            };
            return updated;
          } else {
            const newItem: UniqueCall = {
              id: data.id,
              callerNumber: data.callerNumber,
              callerName: data.callerName,
              startTime: data.startTime,
              status: data.status,
              duration: data.duration,
              frequency: 1,
              allCalls: [{
                id: data.id,
                callerNumber: data.callerNumber,
                callerName: data.callerName,
                startTime: data.startTime,
                endTime: data.endTime,
                status: data.status,
                duration: data.duration,
                created_at: data.timestamp,
              }],
              direction: data.direction,
              agentExten: data.agentExten ?? null,
              otherParty: data.otherParty ?? null,
            };
            isNewCall = true;
            return [newItem, ...prevLogs];
          }
        });
        
        // Auto-select logic - select calls with important statuses
        if (shouldAutoSelect) {
          console.log('✅ Auto-selecting call:', data.id, 'with status:', data.status, 'isNewCall:', isNewCall);
          
          // Use setTimeout to ensure state updates are processed
          setTimeout(() => {
            setSelectedCallId(data.id);
            if (data.callerNumber) {
              setSelectedPhoneNumber(data.callerNumber);
              console.log('📞 Auto-selected call with phone:', data.callerNumber);
            }
          }, 50);
        }

        // Also refresh call stats
        callLogService.getTodayStats().then(setCallStats).catch(console.error);
      });

      // Test the connection
      console.log('📡 Echo channel setup complete, testing connection...');

      // Cleanup function
      return () => {
        console.log('🧹 Cleaning up Echo listener');
        window.Echo.leaveChannel('call-console');
        setEchoConnected(false);
      };
    } else {
      console.warn('⚠️ Window.Echo is not available');
      setEchoConnected(false);
    }
  }, []);

  // React Query hook to fetch customers by phone number
  const customersQuery = useQuery<{ data: any[]; message: string; success: boolean }>({
    queryKey: ['customers', selectedPhoneNumber],
    // Disabled and returning empty to remove WordPress integration
    queryFn: async () => ({ data: [], message: '', success: true }),
    enabled: false,
    retry: 0,
    staleTime: 5 * 60 * 1000,
  });

  // Handle customer data updates
  useEffect(() => {
    if (customersQuery.data?.data) {
      setCustomers(customersQuery.data.data);
      // Auto-select first customer if there are any customers (single or multiple)
      if (customersQuery.data.data.length > 0) {
        setSelectedCustomer(customersQuery.data.data[0]);
      } else {
        setSelectedCustomer(null);
      }
    } else {
      setCustomers([]);
      setSelectedCustomer(null);
    }
  }, [customersQuery.data]);

  // Orders and notes queries removed

  // Function to handle call selection
  const handleCallSelect = async (callId: number) => {
    if (selectedCallId === callId) {
      // If same call is clicked, deselect it
      setSelectedCallId(null);
      setSelectedPhoneNumber(null);
      setCustomers([]);
      setSelectedCustomer(null);
      return;
    }

    setSelectedCallId(callId);
    
    // Find the selected call and get its phone number
    const selectedCall = callLogs.find(call => call.id === callId);
    if (selectedCall && selectedCall.callerNumber) {
      setSelectedPhoneNumber(selectedCall.callerNumber);
    } else {
      setSelectedPhoneNumber(null);
      setCustomers([]);
      setSelectedCustomer(null);
    }
  };

  // Function to toggle call expansion
  const toggleCallExpansion = (callerNumber: string) => {
    setExpandedCalls(prev => {
      const newSet = new Set(prev);
      if (newSet.has(callerNumber)) {
        newSet.delete(callerNumber);
      } else {
        newSet.add(callerNumber);
      }
      return newSet;
    });
  };

  // Function to handle customer selection
  const handleCustomerSelect = (customer: any) => {
    setSelectedCustomer(customer);
  };

  // WooCommerce order handlers removed

  // Removed unused formatting helpers

  return (
    <div className="bg-gray-50 dark:bg-gray-900 h-[calc(100vh-4rem)]">
      {/* WooCommerce modals removed */}

      <div className="flex gap-4 p-6 h-full overflow-hidden">
        {/* Left Sidebar - Incoming Calls Component */}
        <div className="w-80 lg:w-[30rem] xl:w-[34rem] flex-shrink-0">
          <CallMonitor
            callLogs={callLogs}
            selectedCallId={selectedCallId}
            loading={loading}
            error={error}
            echoConnected={echoConnected}
            expandedCalls={expandedCalls}
            onCallSelect={handleCallSelect}
            onToggleExpansion={toggleCallExpansion}
          />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0">
            {/* Main Content Flex Layout */}
            <div className="flex flex-col lg:flex-row gap-4 h-full">
              {/* Customer Orders Component - Takes up 2/3 width */}
              <div className="flex-1 lg:flex-[2] min-w-0">
                <CallDetails selectedCallId={selectedCallId} />
              </div>

              {/* Right Column - Customer Profile and Stats */}
              <div className="flex flex-col min-h-0 lg:flex-1 lg:min-w-80 overflow-hidden">
              <div className="flex-1 overflow-y-auto narrow-scrollbar">
                  <div className="space-y-6 p-1">
                    {/* Order Notes Panel removed */}
                    
                    

                    {/* Customer Profile Component */}
                    <CustomerProfile
                      selectedCallId={selectedCallId}
                      selectedPhoneNumber={selectedPhoneNumber}
                      customersQuery={customersQuery}
                      customers={customers}
                      selectedCustomer={selectedCustomer}
                      onSelectCustomer={handleCustomerSelect}
                    />

                    {/* Today's Statistics Component */}
                    <TodayStatistics
                      loading={loading}
                      error={error}
                      callStats={callStats}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallConsole;