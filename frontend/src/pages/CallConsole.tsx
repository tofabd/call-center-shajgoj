import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { callLogService } from '@services/callLogService';
import type { CallStats, CallLog } from '@services/callLogService';
// Removed WordPress/WooCommerce API imports
import '@services/echo'; // Import Echo setup
import OrderDetailsModal from '@/components/CallConsole/OrderDetailsModal';
import EditOrderModal from '@/components/CallConsole/EditOrderModal';
import CreateOrder from '@/components/CallConsole/CreateOrderModal';
import IncomingCalls from '@/components/CallConsole/IncomingCalls';
import CallDetails from '@/components/CallConsole/CallDetails';
import OrderNotesPanel from '@/components/CallConsole/OrderNotesPanel';
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
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<any | null>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isEditOrderModalOpen, setIsEditOrderModalOpen] = useState(false);
  const [selectedOrderForEdit, setSelectedOrderForEdit] = useState<any | null>(null);
  const [isCreateOrderModalOpen, setIsCreateOrderModalOpen] = useState(false);
  const [expandedCalls, setExpandedCalls] = useState<Set<string>>(new Set());
  const [selectedOrderForNotes, setSelectedOrderForNotes] = useState<any | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  // Transform flat call logs into grouped unique calls for UI
  const transformToUniqueCalls = (logs: CallLog[]): UniqueCall[] => {
    const callsByNumber: Record<string, CallLog[]> = {};
    for (const log of logs) {
      if (!log.callerNumber) continue;
      if (!callsByNumber[log.callerNumber]) callsByNumber[log.callerNumber] = [];
      callsByNumber[log.callerNumber].push(log);
    }
    const uniqueCalls: UniqueCall[] = Object.entries(callsByNumber).map(([callerNumber, callerLogs]) => {
      // Sort newest first
      callerLogs.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
      const latest = callerLogs[0];
      return {
        id: latest.id,
        callerNumber,
        callerName: latest.callerName ?? null,
        startTime: latest.startTime,
        status: latest.status,
        duration: latest.duration,
        frequency: callerLogs.length,
        allCalls: callerLogs.map((c) => ({
          id: c.id,
          callerNumber: c.callerNumber,
          callerName: c.callerName ?? null,
          startTime: c.startTime,
          endTime: c.endTime,
          status: c.status,
          duration: c.duration,
          created_at: c.startTime,
        })),
      };
    });
    // Sort groups: newest first by latest startTime
    uniqueCalls.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    return uniqueCalls;
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
          const existingCallIndex = prevLogs.findIndex(call => call.callerNumber === data.callerNumber);
          
          if (existingCallIndex >= 0) {
            // Update existing unique call
            const updatedLogs = [...prevLogs];
            const existingCall = updatedLogs[existingCallIndex];
            
            // Check if this specific call already exists in allCalls
            const existingSubCallIndex = existingCall.allCalls.findIndex(call => call.id === data.id);
            
            if (existingSubCallIndex >= 0) {
              // Update existing call in allCalls
              existingCall.allCalls[existingSubCallIndex] = {
                ...existingCall.allCalls[existingSubCallIndex],
                status: data.status,
                endTime: data.endTime,
                duration: data.duration
              };
              // Update main call if this is the latest one (first in array)
              if (existingSubCallIndex === 0) {
                existingCall.status = data.status;
                existingCall.duration = data.duration;
                existingCall.id = data.id; // Ensure main call ID matches latest call
              }
            } else {
              // Add new call to allCalls and increment frequency
              existingCall.allCalls.unshift({
                id: data.id,
                callerNumber: data.callerNumber,
                callerName: data.callerName,
                startTime: data.startTime,
                endTime: data.endTime,
                status: data.status,
                duration: data.duration,
                created_at: data.timestamp
              });
              existingCall.frequency = existingCall.allCalls.length;
              existingCall.startTime = data.startTime; // Update to latest call time
              existingCall.status = data.status;
              existingCall.duration = data.duration;
              existingCall.id = data.id; // Update main call ID to latest call
              isNewCall = true;
            }
            
            return updatedLogs;
          } else {
            // Add new unique call
            const newUniqueCall: UniqueCall = {
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
                created_at: data.timestamp
              }]
            };
            
            isNewCall = true;
            return [newUniqueCall, ...prevLogs];
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

  // React Query hook to fetch orders by phone number
  const ordersQuery = useQuery<{ data: any[]; message: string; success: boolean }>({
    queryKey: ['customerOrders', selectedPhoneNumber],
    // Disabled and returning empty to remove WordPress integration
    queryFn: async () => ({ data: [], message: '', success: true }),
    enabled: false,
    retry: 0,
    staleTime: 5 * 60 * 1000,
  });

  // React Query to fetch order notes for selected order
  const orderNotesQuery = useQuery<{ data: any[] }>({
    queryKey: ['orderNotes', selectedOrderForNotes?.id],
    // Disabled and returning empty to remove WordPress integration
    queryFn: async () => ({ data: [] }),
    enabled: false,
    staleTime: 5 * 60 * 1000,
  });

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

  // Action handlers for orders
  const handleViewOrder = (orderId: number) => {
    const order = ordersQuery.data?.data?.find(o => o.id === orderId);
    if (order) {
      setSelectedOrderForModal(order);
      setIsOrderModalOpen(true);
    }
  };

  // Handler to show order notes in third column
  const handleShowOrderNotes = (orderId: number) => {
    const order = ordersQuery.data?.data?.find(o => o.id === orderId);
    if (order) {
      setSelectedOrderForNotes(order);
      setSelectedOrderId(orderId);
    }
  };

  const closeOrderModal = () => {
    setIsOrderModalOpen(false);
    setSelectedOrderForModal(null);
  };

  const handleEditOrder = (orderId: number) => {
    const order = ordersQuery.data?.data?.find(o => o.id === orderId);
    if (order) {
      setSelectedOrderForEdit(order);
      setIsEditOrderModalOpen(true);
    }
  };

  const closeEditOrderModal = () => {
    setIsEditOrderModalOpen(false);
    setSelectedOrderForEdit(null);
  };

  const handleOrderSave = (updatedOrder: any) => {
    // Refresh the orders query to get updated data
    ordersQuery.refetch();
    if (selectedOrderForNotes && updatedOrder.id === selectedOrderForNotes.id) {
      orderNotesQuery.refetch();
    }
    console.log('Order updated:', updatedOrder);
  };

  const handleDeleteOrder = (orderId: number) => {
    console.log('Delete order:', orderId);
    // TODO: Implement delete order functionality
  };

  const handleCreateOrder = () => {
    setIsCreateOrderModalOpen(true);
  };

  const closeCreateOrderModal = () => {
    setIsCreateOrderModalOpen(false);
  };

  const handleOrderCreated = () => {
    // Refresh the orders query to get updated data
    ordersQuery.refetch();
    console.log('New order created successfully');
  };

  // Removed unused formatting helpers

  return (
    <div className="bg-gray-50 dark:bg-gray-900 h-[calc(100vh-4rem)]">
      {/* Order Details Modal */}
      {isOrderModalOpen && selectedOrderForModal && (
        <OrderDetailsModal
          order={selectedOrderForModal}
          isOpen={isOrderModalOpen}
          onClose={closeOrderModal}
          onEdit={() => handleEditOrder(selectedOrderForModal.id)}
        />
      )}

      {/* Edit Order Modal */}
      {isEditOrderModalOpen && selectedOrderForEdit && (
        <EditOrderModal
          order={selectedOrderForEdit}
          isOpen={isEditOrderModalOpen}
          onClose={closeEditOrderModal}
          onSave={handleOrderSave}
        />
      )}

      {/* Create Order Modal */}
      {isCreateOrderModalOpen && (
        <CreateOrder
          isOpen={isCreateOrderModalOpen}
          customerProfile={selectedCustomer}
          onClose={closeCreateOrderModal}
          onOrderCreated={handleOrderCreated}
        />
      )}

      <div className="flex gap-4 p-6 h-full overflow-hidden">
        {/* Left Sidebar - Incoming Calls Component */}
        <div className="w-80 lg:w-96 flex-shrink-0">
          <IncomingCalls
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
                    {/* Order Notes Panel */}
                    {selectedOrderForNotes && (
                      <OrderNotesPanel
                        order={selectedOrderForNotes}
                        notesQuery={orderNotesQuery}
                        onClose={() => {
                          setSelectedOrderForNotes(null);
                          setSelectedOrderId(null);
                        }}
                      />
                    )}
                    
                    

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