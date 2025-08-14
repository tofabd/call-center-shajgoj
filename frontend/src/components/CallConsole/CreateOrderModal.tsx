import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast, Bounce, Flip } from 'react-toastify';
import { X, Plus, Trash2, Package, AlertCircle, Save, Loader2 } from 'lucide-react';
import api, { getPaymentMethods, getShippingZonesWithMethods } from '../../services/api';
import ProductSearch from './ProductSearchModal';

interface Product {
  id: number;
  name: string;
  sku: string;
  price: string;
  regular_price: string;
  stock_status: string;
}

interface LineItem {
  product_id: number;
  name: string;
  quantity: number;
  price: string;
  total: string;
  sku?: string;
}

interface CustomerProfile {
  id?: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  billing: {
    first_name: string;
    last_name: string;
    company?: string;
    address_1: string;
    address_2?: string;
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
    company?: string;
    address_1: string;
    address_2?: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
}

interface PaymentMethod {
  id: string;
  title: string;
  description?: string;
  enabled: boolean;
}

interface ShippingMethod {
  id: string;
  instance_id: string;
  title: string;
  zone_name: string;
  zone_id: number;
  cost: string;
}

interface CreateOrderProps {
  isOpen: boolean;
  customerProfile: CustomerProfile | null;
  onClose: () => void;
  onOrderCreated: () => void;
}

interface OrderData {
  payment_method: string;
  payment_method_title: string;
  set_paid: boolean;
  status: string;
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
    product_id: number;
    quantity: number;
  }>;
  shipping_lines: Array<{
    method_id: string;
    method_title: string;
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

const CreateOrder: React.FC<CreateOrderProps> = ({
  isOpen,
  customerProfile,
  onClose,
  onOrderCreated
}) => {
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bacs');
  const [paymentMethodTitle, setPaymentMethodTitle] = useState('Direct Bank Transfer');
  const [setPaid, setSetPaid] = useState(false);
  const [shippingMethod, setShippingMethod] = useState('');
  const [shippingTitle, setShippingTitle] = useState('');
  const [shippingTotal, setShippingTotal] = useState('0.00');
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState<PaymentMethod[]>([]);
  const [availableShippingMethods, setAvailableShippingMethods] = useState<ShippingMethod[]>([]);

  const queryClient = useQueryClient();

  // Fetch payment methods
  const { data: paymentMethodsData, isLoading: paymentMethodsLoading } = useQuery({
    queryKey: ['paymentMethods'],
    queryFn: getPaymentMethods,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch shipping methods (with costs)
  const { data: shippingMethodsData, isLoading: shippingMethodsLoading } = useQuery({
    queryKey: ['shippingZonesMethods'],
    queryFn: getShippingZonesWithMethods,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Update payment methods when data is loaded
  useEffect(() => {
    if (paymentMethodsData?.success && paymentMethodsData?.data) {
      setAvailablePaymentMethods(paymentMethodsData.data);
      // Set default payment method to 'Cash on Delivery' if available
      let defaultMethod = paymentMethodsData.data.find(
        (method) =>
          method.id === 'cod' ||
          method.title?.toLowerCase().includes('cash on delivery')
      );
      if (!defaultMethod && paymentMethodsData.data.length > 0) {
        defaultMethod = paymentMethodsData.data[0];
      }
      if (defaultMethod) {
        setPaymentMethod(defaultMethod.id);
        setPaymentMethodTitle(defaultMethod.title);
      }
    }
  }, [paymentMethodsData]);

  // Update shipping methods when data is loaded
  useEffect(() => {
    if (shippingMethodsData?.success && shippingMethodsData?.data) {
      setAvailableShippingMethods(shippingMethodsData.data);
      // Set default shipping method to 'Inside Dhaka' (not free shipping) if available
      let defaultMethod = shippingMethodsData.data.find(
        (method: ShippingMethod) =>
          (method.title?.toLowerCase().includes('inside dhaka') &&
           method.zone_name?.toLowerCase().includes('inside dhaka') &&
           !method.title?.toLowerCase().includes('free shipping'))
      );
      if (!defaultMethod) {
        // Fallback: any 'Inside Dhaka' in title or zone_name
        defaultMethod = shippingMethodsData.data.find(
          (method: ShippingMethod) =>
            (method.title?.toLowerCase().includes('inside dhaka') ||
             method.zone_name?.toLowerCase().includes('inside dhaka')) &&
            !method.title?.toLowerCase().includes('free shipping')
        );
      }
      if (!defaultMethod && shippingMethodsData.data.length > 0) {
        defaultMethod = shippingMethodsData.data[0];
      }
      if (defaultMethod) {
        setShippingMethod(`${defaultMethod.id}-${defaultMethod.instance_id}`);
        setShippingTitle(defaultMethod.title);
        setShippingTotal(defaultMethod.cost || '0');
      }
    }
  }, [shippingMethodsData]);



  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (orderData: OrderData) => {
      console.log('Creating order with data:', orderData);
      const response = await api.post('/woocom/create-order', orderData);
      return response.data;
    },
    onSuccess: (data) => {
      console.log('Order created successfully:', data);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      
      toast.success(
        `Order created successfully! Order ID: #${data.id}`,
        {
          autoClose: 4000,
          transition: Flip,
        }
      );
      
      onOrderCreated();
      onClose();
      resetForm();
    },
    onError: (error: ApiError) => {
      console.error('Order creation error:', error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'Failed to create order';
      
      toast.error(errorMessage, {
        autoClose: 5000,
        transition: Bounce,
      });
      
      setError(errorMessage);
    }
  });

  // Reset form
  const resetForm = () => {
    setLineItems([]);
    setError('');
    setPaymentMethod('bacs');
    setPaymentMethodTitle('Direct Bank Transfer');
    setSetPaid(true);
    setShippingMethod('');
    setShippingTitle('');
    setShippingTotal('0.00');
  };

  // Calculate total
  const calculateTotal = () => {
    const itemsTotal = lineItems.reduce((sum, item) => {
      return sum + (parseFloat(item.price) * item.quantity);
    }, 0);
    return (itemsTotal + parseFloat(shippingTotal)).toFixed(2);
  };

  // Calculate subtotal (without shipping)
  const calculateSubtotal = () => {
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
      updateLineItemQuantity(existingItemIndex, lineItems[existingItemIndex].quantity + 1);
    } else {
      const newItem: LineItem = {
        product_id: product.id,
        name: product.name,
        quantity: 1,
        price: product.price,
        total: product.price,
        sku: product.sku
      };
      setLineItems([...lineItems, newItem]);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerProfile || lineItems.length === 0) {
      setError('Please add at least one product to the order');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const orderData = {
        payment_method: paymentMethod,
        payment_method_title: paymentMethodTitle,
        set_paid: setPaid,
        status: setPaid ? 'processing' : 'pending',
        billing: {
          first_name: customerProfile.billing.first_name || customerProfile.first_name,
          last_name: customerProfile.billing.last_name || customerProfile.last_name,
          company: customerProfile.billing.company || '',
          address_1: customerProfile.billing.address_1 || '',
          address_2: customerProfile.billing.address_2 || '',
          city: customerProfile.billing.city || '',
          state: customerProfile.billing.state || '',
          postcode: customerProfile.billing.postcode || '',
          country: customerProfile.billing.country || 'BD',
          email: customerProfile.billing.email || customerProfile.email,
          phone: customerProfile.billing.phone || customerProfile.phone
        },
        shipping: {
          first_name: customerProfile.shipping.first_name || customerProfile.first_name,
          last_name: customerProfile.shipping.last_name || customerProfile.last_name,
          company: customerProfile.shipping.company || '',
          address_1: customerProfile.shipping.address_1 || '',
          address_2: customerProfile.shipping.address_2 || '',
          city: customerProfile.shipping.city || '',
          state: customerProfile.shipping.state || '',
          postcode: customerProfile.shipping.postcode || '',
          country: customerProfile.shipping.country || 'BD'
        },
        line_items: lineItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity
        })),
        shipping_lines: [{
          method_id: shippingMethod.split('-')[0], // Extract method_id from combined value
          method_title: shippingTitle,
          total: shippingTotal
        }]
      };

      await createOrderMutation.mutateAsync(orderData);
    } catch (error) {
      console.error('Error creating order:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: string | number) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `৳${numAmount.toFixed(2)}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Package className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Create New Order</h2>
                {customerProfile && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    For: {customerProfile.first_name} {customerProfile.last_name} ({customerProfile.email})
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
              <span className="text-red-700 dark:text-red-300">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Order Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Payment Method
                </label>
                {paymentMethodsLoading ? (
                  <div className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700">
                    Loading payment methods...
                  </div>
                ) : (
                  <select
                    value={paymentMethod}
                    onChange={(e) => {
                      const selectedValue = e.target.value;
                      setPaymentMethod(selectedValue);
                      
                      // Find the selected payment method and update title
                      const selectedMethod = availablePaymentMethods.find(method => method.id === selectedValue);
                      if (selectedMethod) {
                        setPaymentMethodTitle(selectedMethod.title);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  >
                    {availablePaymentMethods.map((method) => (
                      <option key={method.id} value={method.id}>
                        {method.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Shipping Method
                </label>
                {shippingMethodsLoading ? (
                  <div className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700">
                    Loading shipping methods...
                  </div>
                ) : (
                  <select
                    value={shippingMethod}
                    onChange={(e) => {
                      const selectedValue = e.target.value;
                      setShippingMethod(selectedValue);
                      // Find the selected shipping method and update details
                      const selectedMethod = availableShippingMethods.find(method => `${method.id}-${method.instance_id}` === selectedValue);
                      if (selectedMethod) {
                        setShippingTitle(selectedMethod.title);
                        setShippingTotal(selectedMethod.cost || '0'); // Always update cost to match method
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  >
                    {availableShippingMethods.map((method) => (
                      <option key={`${method.id}-${method.instance_id}`} value={`${method.id}-${method.instance_id}`}>
                        {method.title} ({method.zone_name}) - ${method.cost}
                      </option>
                    ))}
                  </select>
                )}
                
                <div className="mt-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Shipping Cost
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={shippingTotal}
                    onChange={(e) => setShippingTotal(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Payment Status and Shipping Cost Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="setPaid"
                  checked={setPaid}
                  onChange={(e) => setSetPaid(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="setPaid" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Mark order as paid
                </label>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Shipping: {formatCurrency(shippingTotal)}
              </div>
            </div>

            {/* Line Items */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Order Items</h3>
                <button
                  type="button"
                  onClick={openProductSearch}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Product</span>
                </button>
              </div>

              {lineItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No products added yet. Click "Add Product" to get started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {lineItems.map((item, index) => (
                    <div key={index} className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 dark:text-white">{item.name}</h4>
                        {item.sku && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">SKU: {item.sku}</p>
                        )}
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {formatCurrency(item.price)} each
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => updateLineItemQuantity(index, item.quantity - 1)}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                          disabled={item.quantity <= 1}
                        >
                          <span className="text-lg font-bold">−</span>
                        </button>
                        <span className="w-12 text-center font-medium">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateLineItemQuantity(index, item.quantity + 1)}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                        >
                          <span className="text-lg font-bold">+</span>
                        </button>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {formatCurrency(item.total)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLineItem(index)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Order Summary */}
            {lineItems.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Order Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                    <span className="font-medium">{formatCurrency(calculateSubtotal())}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Shipping:</span>
                    <span className="font-medium">{formatCurrency(shippingTotal)}</span>
                  </div>
                  <div className="border-t border-gray-200 dark:border-gray-600 pt-2">
                    <div className="flex justify-between">
                      <span className="text-lg font-semibold text-gray-900 dark:text-white">Total:</span>
                      <span className="text-lg font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(calculateTotal())}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || lineItems.length === 0 || !customerProfile}
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Create Order</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
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

export default CreateOrder;