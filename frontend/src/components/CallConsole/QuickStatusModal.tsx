import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast, Bounce, Flip } from 'react-toastify';
import api from '@/services/api';

interface WooCommerceOrder {
  id: number;
  status: string;
  date_created: string;
  total: string;
  billing: {
    first_name: string;
    last_name: string;
    phone: string;
  };
}

interface QuickStatusModalProps {
  isOpen: boolean;
  order: WooCommerceOrder | null;
  onClose: () => void;
  onStatusUpdate: (orderId: number, newStatus: string) => void;
}

const QuickStatusModal: React.FC<QuickStatusModalProps> = ({
  isOpen,
  order,
  onClose,
  onStatusUpdate
}) => {
  const [selectedStatus, setSelectedStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const queryClient = useQueryClient();

  // Order status options with colors and descriptions
  const statusOptions = [
    { 
      value: 'pending', 
      label: 'Pending Payment', 
      color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300',
      description: 'Awaiting payment confirmation'
    },
    { 
      value: 'processing', 
      label: 'Processing', 
      color: 'text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-300',
      description: 'Order is being prepared'
    },
    { 
      value: 'on-hold', 
      label: 'On Hold', 
      color: 'text-orange-600 bg-orange-100 dark:bg-orange-900 dark:text-orange-300',
      description: 'Order temporarily paused'
    },
    { 
      value: 'completed', 
      label: 'Completed', 
      color: 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300',
      description: 'Order successfully fulfilled'
    },
    { 
      value: 'cancelled', 
      label: 'Cancelled', 
      color: 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300',
      description: 'Order has been cancelled'
    },
    { 
      value: 'refunded', 
      label: 'Refunded', 
      color: 'text-purple-600 bg-purple-100 dark:bg-purple-900 dark:text-purple-300',
      description: 'Payment has been refunded'
    },
    { 
      value: 'failed', 
      label: 'Failed', 
      color: 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300',
      description: 'Order processing failed'
    }
  ];

  // Initialize selected status when order changes
  useEffect(() => {
    if (order) {
      setSelectedStatus(order.status);
    }
  }, [order]);

  // Update order status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (statusData: { orderId: number; status: string }) => {
      const response = await api.post('/woocom/update-order', {
        order_id: statusData.orderId,
        status: statusData.status
      });
      return response.data;
    },
    onSuccess: (data, variables) => {
      // Show success toast
      const statusOption = statusOptions.find(opt => opt.value === variables.status);
      toast.success(
        `Order #${variables.orderId} status updated to ${statusOption?.label || variables.status}`,
        {
          autoClose: 4000,
          transition: Flip,
        }
      );
      
      // Update parent component
      onStatusUpdate(variables.orderId, variables.status);
      
      // Invalidate and refetch orders
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      
      // Close modal
      onClose();
    },
    onError: (error: any) => {
      console.error('Status update error:', error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'Failed to update order status';
      
      // Show error toast
      toast.error(errorMessage, {
        autoClose: 5000,
        transition: Bounce,
      });
    },
    onSettled: () => {
      setIsLoading(false);
    }
  });

  const handleStatusUpdate = async () => {
    if (!order || !selectedStatus || selectedStatus === order.status) {
      return;
    }

    setIsLoading(true);
    updateStatusMutation.mutate({
      orderId: order.id,
      status: selectedStatus
    });
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  if (!isOpen || !order) return null;

  const currentStatusOption = statusOptions.find(opt => opt.value === order.status);
  const selectedStatusOption = statusOptions.find(opt => opt.value === selectedStatus);
  const hasChanges = selectedStatus !== order.status;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Update Order Status
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Order #{order.id} • {order.billing.first_name} {order.billing.last_name}
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Current Status */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Current Status
            </label>
            <div className="flex items-center space-x-3">
              <span className={`px-3 py-1 text-sm rounded-full font-medium ${currentStatusOption?.color}`}>
                {currentStatusOption?.label || order.status}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {currentStatusOption?.description}
              </span>
            </div>
          </div>

          {/* New Status Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Select New Status
            </label>
            <div className="space-y-2">
              {statusOptions.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-center p-2 border rounded-lg cursor-pointer transition-all ${
                    selectedStatus === option.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="status"
                    value={option.value}
                    checked={selectedStatus === option.value}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="sr-only"
                  />
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${
                        selectedStatus === option.value ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                      }`} />
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${option.color}`}>
                        {option.label}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {option.description}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleStatusUpdate}
            disabled={isLoading || !hasChanges}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 rounded-lg transition-colors flex items-center space-x-2 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Updating...</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span>Update Status</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickStatusModal;