import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { callLogService } from '@services/callLogService';
import type { CallStats  } from '@services/callLogService';
import api, { getOrderNotes } from '@services/api';
import '@services/echo'; // Import Echo setup
import OrderDetailsModal from '@/components/CallConsole/OrderDetailsModal';
import EditOrderModal from '@/components/CallConsole/EditOrderModal';
import CreateOrder from '@/components/CallConsole/CreateOrderModal';
import IncomingCalls from '@/components/CallConsole/IncomingCalls';
import CustomerOrders from '@/components/CallConsole/CustomerOrders';
import type { CustomerOrdersProps } from '@/components/CallConsole/CustomerOrders';
import OrderNotesPanel from '@/components/CallConsole/OrderNotesPanel';
import CustomerProfile from '@/components/CallConsole/CustomerProfile';
import TodayStatistics from '@/components/CallConsole/TodayStatistics';
import FollowUpPanel from '@/components/CallConsole/FollowUpPanel';

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

// Interface for WooCommerce order data
interface WooCommerceOrder {
  id: number;
  status: string;
  date_created: string;
  date_created_gmt: string;
  total: string;
  billing: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
    email: string;
    phone: string;
  };
  shipping: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  line_items: Array<{
    id: number;
    name: string;
    product_id: number;
    variation_id: number;
    quantity: number;
    tax_class: string;
    subtotal: string;
    subtotal_tax: string;
    total: string;
    total_tax: string;
    sku: string;
    price: string;
    meta_data: any[];
  }>;
  _links: {
    self: { href: string };
    collection: { href: string };
  };
}

// Interface for WooCommerce customer data
interface WooCommerceCustomer {
  id: number;
  date_created: string;
  date_created_gmt: string;
  date_modified: string;
  date_modified_gmt: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  username: string;
  billing: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
    email: string;
    phone: string;
  };
  shipping: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  is_paying_customer: boolean;
  avatar_url: string;
  meta_data: any[];
  _links: {
    self: { href: string };
    collection: { href: string };
  };
}

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
  const [customers, setCustomers] = useState<WooCommerceCustomer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<WooCommerceCustomer | null>(null);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [echoConnected, setEchoConnected] = useState(false);
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<WooCommerceOrder | null>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isEditOrderModalOpen, setIsEditOrderModalOpen] = useState(false);
  const [selectedOrderForEdit, setSelectedOrderForEdit] = useState<WooCommerceOrder | null>(null);
  const [isCreateOrderModalOpen, setIsCreateOrderModalOpen] = useState(false);
  const [expandedCalls, setExpandedCalls] = useState<Set<string>>(new Set());
  const [selectedOrderForNotes, setSelectedOrderForNotes] = useState<WooCommerceOrder | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [logs, stats] = await Promise.all([
          callLogService.getCallLogs(),
          callLogService.getTodayStats()
        ]);
        setCallLogs(logs);
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
  const customersQuery = useQuery({
    queryKey: ['customers', selectedPhoneNumber],
    queryFn: async () => {
      if (!selectedPhoneNumber) return { data: [], message: '', success: true };
      const response = await api.get(`/woocom/customers/${selectedPhoneNumber}`);
      return response.data;
    },
    enabled: !!selectedPhoneNumber,
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
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
  const ordersQuery = useQuery({
    queryKey: ['customerOrders', selectedPhoneNumber],
    queryFn: async () => {
      if (!selectedPhoneNumber) return { data: [], message: '', success: true };
      const response = await api.get(`/woocom/orders/${selectedPhoneNumber}`);
      return response.data;
    },
    enabled: !!selectedPhoneNumber,
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // React Query to fetch order notes for selected order
  const orderNotesQuery = useQuery({
    queryKey: ['orderNotes', selectedOrderForNotes?.id],
    queryFn: async () => {
      if (!selectedOrderForNotes) return { data: [] };
      return await getOrderNotes(selectedOrderForNotes.id);
    },
    enabled: !!selectedOrderForNotes,
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
  const handleCustomerSelect = (customer: WooCommerceCustomer) => {
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

  const formatTime = (timeString: string) => {
    const date = new Date(timeString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateTime = (timeString: string) => {
    const date = new Date(timeString);
    return date.toLocaleString([], { 
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatCurrency = (amount: string | number) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `৳${numAmount.toFixed(2)}`;
  };

  const getOrderStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300';
      case 'pending':
        return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300';
      case 'cancelled':
        return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300';
      case 'processing':
        return 'text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-300';
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'answered':
        return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300';
      case 'busy':
        return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300';
      case 'no answer':
        return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300';
      case 'ringing':
        return 'text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-300';
      case 'started':
        return 'text-purple-600 bg-purple-100 dark:bg-purple-900 dark:text-purple-300';
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-900 dark:text-gray-300';
    }
  };

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
                <CustomerOrders
                  selectedCallId={selectedCallId}
                  ordersQuery={ordersQuery}
                  onViewOrder={handleViewOrder}
                  onEditOrder={handleEditOrder}
                  onDeleteOrder={handleDeleteOrder}
                  onCreateOrder={handleCreateOrder}
                  onShowOrderNotes={handleShowOrderNotes}
                  refetchOrderNotes={orderNotesQuery.refetch}
                  selectedOrderId={selectedOrderId}
                />
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
                    
                    {/* Follow-up Panel Component */}
                    <FollowUpPanel
                      selectedPhoneNumber={selectedPhoneNumber}
                      customerName={selectedCustomer?.first_name && selectedCustomer?.last_name 
                        ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}` 
                        : selectedCustomer?.first_name || selectedCustomer?.last_name}
                      customerEmail={selectedCustomer?.email}
                      woocommerce_customer_id={selectedCustomer?.id}
                      currentOrder={selectedOrderForNotes || null}
                      customerOrders={ordersQuery.data?.data || []}
                    />

                    {/* Customer Profile Component */}
                    <CustomerProfile
                      selectedCallId={selectedCallId}
                      selectedPhoneNumber={selectedPhoneNumber}
                      customersQuery={customersQuery}
                      customers={customers}
                      selectedCustomer={selectedCustomer}
                      onCustomerSelect={handleCustomerSelect}
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