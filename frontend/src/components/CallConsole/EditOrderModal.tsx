import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Package, Save, AlertCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast, Bounce, Flip } from 'react-toastify';
import api from '@/services/api';
import ProductSearch from './ProductSearchModal';

interface WooCommerceOrder {
  id: number;
  status: string;
  date_created: string;
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
    meta_data: Array<Record<string, unknown>>;
  }>;
}

interface Product {
  id: number;
  name: string;
  sku: string;
  price: string;
  regular_price: string;
  stock_status: string;
}

interface LineItem {
  id?: number;
  product_id: number;
  name: string;
  quantity: number;
  price: string;
  total: string;
  sku?: string;
}

interface EditOrderModalProps {
  isOpen: boolean;
  order: WooCommerceOrder | null;
  onClose: () => void;
  onSave: (updatedOrder: WooCommerceOrder) => void;
}

interface UpdateOrderData {
  order_id: number;
  status: string;
  total: string;
  line_items: Array<{
    id?: number;
    product_id?: number;
    quantity: number;
    total: string;
  }>;
}

interface ApiError {
  response?: {
    data?: {
      message?: string;
      error?: string;
    };
  };
  message?: string;
}

const EditOrderModal: React.FC<EditOrderModalProps> = ({
  isOpen,
  order,
  onClose,
  onSave
}) => {

  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const queryClient = useQueryClient();

  // Update order mutation
  const updateOrderMutation = useMutation({
    mutationFn: async (orderData: UpdateOrderData) => {
      console.log('Sending order update data:', orderData);
      const response = await api.post('/woocom/update-order', orderData);
      return response.data;
    },
    onSuccess: (data) => {
      console.log('Order updated successfully:', data);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      
      // Show success toast
      toast.success(
        `Order #${order?.id} updated successfully!`,
        {
          autoClose: 4000,
          transition: Flip,
        }
      );
      
      onSave(data);
      onClose();
    },
    onError: (error: ApiError) => {
      console.error('Order update error:', error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'Failed to update order';
      
      // Show error toast
      toast.error(errorMessage, {
        autoClose: 5000,
        transition: Bounce,
      });
      
      setError(errorMessage);
    }
  });

  // Initialize form data when order changes
  useEffect(() => {
    if (order) {
      setLineItems(order.line_items.map(item => ({
        id: item.id,
        product_id: item.product_id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
        sku: item.sku
      })));
      setError('');
    }
  }, [order]);

  // Calculate total
  const calculateTotal = () => {
    return lineItems.reduce((sum, item) => {
      return sum + (parseFloat(item.price) * item.quantity);
    }, 0).toFixed(2);
  };

  // Update line item quantity
  const updateLineItemQuantity = (index: number, quantity: number) => {
    if (quantity < 0) return;
    
    const updatedItems = [...lineItems];
    updatedItems[index].quantity = quantity;
    updatedItems[index].total = (parseFloat(updatedItems[index].price) * quantity).toFixed(2);
    setLineItems(updatedItems);
  };

  // Remove line item
  const removeLineItem = (index: number) => {
    const updatedItems = lineItems.filter((_, i) => i !== index);
    setLineItems(updatedItems);
  };

  // Open product search modal
  const openProductSearch = () => {
    setShowProductSearch(true);
  };

  // Close product search modal
  const closeProductSearch = () => {
    setShowProductSearch(false);
  };

  // Add product to line items
  const addProduct = (product: Product) => {
    const existingItemIndex = lineItems.findIndex(item => item.product_id === product.id);
    
    if (existingItemIndex >= 0) {
      // If product already exists, increase quantity
      updateLineItemQuantity(existingItemIndex, lineItems[existingItemIndex].quantity + 1);
    } else {
      // Add new product (without id since it's new)
      const newItem: LineItem = {
        product_id: product.id,
        name: product.name,
        quantity: 1,
        price: product.price,
        total: product.price,
        sku: product.sku
        // Note: no 'id' field for new items
      };
      setLineItems([...lineItems, newItem]);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    setIsLoading(true);
    setError('');

    try {
      const orderData: UpdateOrderData = {
        order_id: order.id,
        status: order.status, // Include current status since backend requires it
        total: calculateTotal(),
        line_items: lineItems.map(item => {
          // For existing line items (with id), include id
          // For new line items (without id), only include product_id
          if (item.id) {
            return {
              id: item.id,
              quantity: item.quantity,
              total: item.total
            };
          } else {
            return {
              product_id: item.product_id,
              quantity: item.quantity,
              total: item.total
            };
          }
        })
      };

      await updateOrderMutation.mutateAsync(orderData);
    } catch (error) {
      console.error('Error updating order:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: string | number) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `৳${numAmount.toFixed(2)}`;
  };

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Package className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Edit Order</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Order #{order.id}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="flex items-center space-x-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Line Items */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Order Items</h4>
                  <button
                    type="button"
                    onClick={openProductSearch}
                    className="px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Product</span>
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                {/* Line Items List */}
                <div className="space-y-4">
                  {lineItems.map((item, index) => (
                    <div key={`${item.product_id}-${index}`} className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex-1">
                        <h5 className="font-medium text-gray-900 dark:text-white">{item.name}</h5>
                        {item.sku && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">SKU: {item.sku}</p>
                        )}
                        <p className="text-sm text-gray-500 dark:text-gray-400">Unit Price: {formatCurrency(item.price)}</p>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => updateLineItemQuantity(index, item.quantity - 1)}
                          className="w-8 h-8 flex items-center justify-center bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                          disabled={item.quantity <= 1}
                        >
                          -
                        </button>
                        
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateLineItemQuantity(index, parseInt(e.target.value) || 1)}
                          className="w-16 px-2 py-1 text-center border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                        
                        <button
                          type="button"
                          onClick={() => updateLineItemQuantity(index, item.quantity + 1)}
                          className="w-8 h-8 flex items-center justify-center bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                        >
                          +
                        </button>
                      </div>
                      
                      <div className="text-right">
                        <p className="font-medium text-gray-900 dark:text-white">{formatCurrency(item.total)}</p>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => removeLineItem(index)}
                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  
                  {lineItems.length === 0 && (
                    <div className="text-center py-8">
                      <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500 dark:text-gray-400">No items in this order</p>
                    </div>
                  )}
                </div>

                {/* Order Total */}
                {lineItems.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold text-gray-900 dark:text-white">Total</span>
                      <span className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(calculateTotal())}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || lineItems.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              <Save className="h-4 w-4" />
              <span>{isLoading ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
      
      {/* Product Search Modal */}
      <ProductSearch
        isOpen={showProductSearch}
        onClose={closeProductSearch}
        onProductSelect={addProduct}
      />
    </div>
  );
};

export default EditOrderModal;