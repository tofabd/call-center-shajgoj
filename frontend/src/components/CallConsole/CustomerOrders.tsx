import React, { useState } from 'react';
import { ShoppingBag, Eye, Edit, Trash2, Plus } from 'lucide-react';
import QuickStatusModal from './QuickStatusModal';

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
    meta_data: Record<string, unknown>[];
  }>;
  _links: {
    self: { href: string };
    collection: { href: string };
  };
}

interface CustomerOrdersProps {
  selectedCallId: number | null;
  ordersQuery: {
    data: { data: WooCommerceOrder[]; message: string; success: boolean } | undefined;
    isLoading: boolean;
    isError: boolean;
    error?: { message?: string } | null;
    refetch: () => void;
  };
  onViewOrder: (orderId: number) => void;
  onEditOrder: (orderId: number) => void;
  onDeleteOrder: (orderId: number) => void;
  onCreateOrder: () => void;
  onShowOrderNotes: (orderId: number) => void;
  refetchOrderNotes?: () => void;
  selectedOrderId?: number | null;
}

export type { CustomerOrdersProps };

// Utility functions
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

const CustomerOrders: React.FC<CustomerOrdersProps> = ({
  selectedCallId,
  ordersQuery,
  onViewOrder,
  onEditOrder,
  onDeleteOrder,
  onCreateOrder,
  onShowOrderNotes,
  refetchOrderNotes,
  selectedOrderId
}) => {
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<WooCommerceOrder | null>(null);

  const handleStatusClick = (order: WooCommerceOrder) => {
    setSelectedOrder(order);
    setIsStatusModalOpen(true);
  };

  const handleStatusUpdate = (orderId: number) => {
    // Invalidate the orders query to refetch data
    ordersQuery.refetch();
    if (refetchOrderNotes && selectedOrder && selectedOrder.id === orderId) {
      refetchOrderNotes();
    }
  };

  const handleCloseModal = () => {
    setIsStatusModalOpen(false);
    setSelectedOrder(null);
  };
  return (
    <div className="flex flex-col h-full">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col h-full">
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-gray-800 dark:to-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-600 rounded-lg">
                <ShoppingBag className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Customer Orders</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedCallId ? 'Order history for selected caller' : 'Select a call to view order history'}
                </p>
              </div>
            </div>
            {selectedCallId && (
              <button
                onClick={onCreateOrder}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                title="Create New Order"
              >
                <Plus className="h-4 w-4" />
                <span>Create Order</span>
              </button>
            )}
          </div>
        </div>
        
        {!selectedCallId ? (
          <div className="p-8 flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShoppingBag className="h-10 w-10 text-gray-400" />
              </div>
              <h4 className="text-gray-900 dark:text-white font-medium text-lg mb-2">No Call Selected</h4>
              <p className="text-gray-500 dark:text-gray-400">Select a call from the incoming calls list to view customer orders</p>
            </div>
          </div>
        ) : ordersQuery.isLoading ? (
          <div className="p-8">
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : ordersQuery.isError && !ordersQuery.data ? (
          <div className="p-8 flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingBag className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-red-600 dark:text-red-400 text-sm font-medium">
                {ordersQuery.error?.message || 'Failed to load orders'}
              </p>
              <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                {ordersQuery.error?.message || 'Unable to fetch order history for this phone number'}
              </p>
            </div>
          </div>
                 ) : ordersQuery.data?.data && ordersQuery.data.data.length > 0 ? (
           <div className="flex-1 overflow-y-auto narrow-scrollbar">
             <div className="p-6">
              <div className="space-y-4">
              {ordersQuery.data.data.map((order) => (
                <div
                  key={order.id}
                  className={`border border-gray-200 dark:border-gray-600 rounded-lg p-4 transition-colors cursor-pointer ${selectedOrderId === order.id ? 'bg-green-100 dark:bg-green-900/40' : 'hover:bg-green-50 dark:hover:bg-green-900/20'}`}
                  onClick={() => onShowOrderNotes(order.id)}
                  title="Click to show order notes"
                >
                  <div className="flex items-center justify-between">
                    {/* Order Number */}
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                        Order #{order.id}
                      </h4>
                    </div>
                    
                    {/* Order Status */}
                    <div className="flex-1 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleStatusClick(order)}
                        className={`px-2 py-1 text-xs rounded-full font-medium transition-all hover:scale-105 hover:shadow-md cursor-pointer ${getOrderStatusColor(order.status)}`}
                        title="Click to change status"
                      >
                        {order.status}
                      </button>
                    </div>
                    
                    {/* Product Count */}
                    <div className="flex-1 text-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {order.line_items?.length || 0} items
                      </span>
                    </div>
                    
                    {/* Total Amount */}
                    <div className="flex-1 text-center">
                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                        {formatCurrency(order.total)}
                      </span>
                    </div>
                    
                    {/* Action Icons */}
                    <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onViewOrder(order.id)}
                        className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900 rounded transition-colors"
                        title="View Order"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onEditOrder(order.id)}
                        className="p-1 text-green-600 hover:text-green-800 hover:bg-green-100 dark:hover:bg-green-900 rounded transition-colors"
                        title="Edit Order"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDeleteOrder(order.id)}
                        className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 dark:hover:bg-red-900 rounded transition-colors"
                        title="Delete Order"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-100 dark:bg-blue-700 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShoppingBag className="h-10 w-10 text-blue-400" />
              </div>
              <h4 className="text-gray-900 dark:text-white font-medium text-lg mb-2">No Orders Found</h4>
              <p className="text-gray-500 dark:text-gray-400">{ordersQuery.data?.message || 'No order history found for this phone number'}</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Quick Status Modal */}
      <QuickStatusModal
        isOpen={isStatusModalOpen}
        order={selectedOrder}
        onClose={handleCloseModal}
        onStatusUpdate={handleStatusUpdate}
      />
    </div>
  );
};

export default CustomerOrders;