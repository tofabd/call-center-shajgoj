import React from 'react';
import { X, ShoppingBag, CreditCard, Package, Mail, Phone, Edit } from 'lucide-react';

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
    meta_data: any[];
  }>;
}

interface OrderDetailsModalProps {
  isOpen: boolean;
  order: WooCommerceOrder | null;
  onClose: () => void;
  onEdit: (orderId: number) => void;
}

const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  isOpen,
  order,
  onClose,
  onEdit
}) => {
  if (!isOpen || !order) return null;

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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <ShoppingBag className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Order Details</h3>
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
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="space-y-6">
            {/* Status and Date Row */}
            <div className="flex items-center space-x-6 pb-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Status:</span>
                <span className={`px-2 py-1 text-xs rounded-full font-medium ${getOrderStatusColor(order.status)}`}>
                  {order.status}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Date:</span>
                <span className="text-sm text-gray-900 dark:text-white">{formatDateTime(order.date_created)}</span>
              </div>
            </div>

            {/* Order Items Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <ShoppingBag className="h-5 w-5 text-blue-600" />
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Order Items</h4>
                  </div>
                  <button
                    onClick={() => onEdit(order.id)}
                    className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                  >
                    <Edit className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="p-6">
                <div className="space-y-0">
                  {order.line_items.map((item, index) => (
                    <div key={index}>
                      <div className="py-3">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h5 className="text-md font-normal text-gray-900 dark:text-white">{item.name}</h5>
                            <div className="flex items-center space-x-4 mt-1">
                              {item.sku && (
                                <span className="text-xs text-gray-600 dark:text-gray-400">SKU: {item.sku}</span>
                              )}
                              <span className="text-xs text-gray-600 dark:text-gray-400">Qty: {item.quantity}</span>
                              <span className="text-xs text-gray-600 dark:text-gray-400">Unit: {formatCurrency(item.price)}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-md font-medium text-gray-900 dark:text-white">{formatCurrency(item.total)}</p>
                          </div>
                        </div>
                      </div>
                      {index < order.line_items.length - 1 && (
                        <hr className="border-gray-200 dark:border-gray-700" />
                      )}
                    </div>
                  ))}
                </div>
                <hr className="border-gray-200 dark:border-gray-700 my-4" />
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">Total</span>
                  <span className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(order.total)}</span>
                </div>
              </div>
            </div>

            {/* Addresses Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Billing Address */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-3">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Billing Address</h4>
                  </div>
                </div>
                <div className="p-6 space-y-3">
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {order.billing.first_name} {order.billing.last_name}
                  </p>
                  {order.billing.company && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">{order.billing.company}</p>
                  )}
                  {order.billing.address_1 && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {order.billing.address_1}
                      {order.billing.address_2 && `, ${order.billing.address_2}`}
                    </p>
                  )}
                  {(order.billing.city || order.billing.state || order.billing.postcode) && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {[order.billing.city, order.billing.state, order.billing.postcode].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {order.billing.country && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">{order.billing.country}</p>
                  )}
                  {order.billing.email && (
                    <div className="flex items-center space-x-3 mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <Mail className="h-4 w-4 text-blue-600" />
                      <p className="text-sm text-gray-700 dark:text-gray-300">{order.billing.email}</p>
                    </div>
                  )}
                  {order.billing.phone && (
                    <div className="flex items-center space-x-3 mt-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <Phone className="h-4 w-4 text-green-600" />
                      <p className="text-sm text-gray-700 dark:text-gray-300">{order.billing.phone}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Shipping Address */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-3">
                    <Package className="h-5 w-5 text-green-600" />
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Shipping Address</h4>
                  </div>
                </div>
                <div className="p-6 space-y-3">
                  {order.shipping.first_name || order.shipping.last_name ? (
                    <>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {order.shipping.first_name} {order.shipping.last_name}
                      </p>
                      {order.shipping.company && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">{order.shipping.company}</p>
                      )}
                      {order.shipping.address_1 && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {order.shipping.address_1}
                          {order.shipping.address_2 && `, ${order.shipping.address_2}`}
                        </p>
                      )}
                      {(order.shipping.city || order.shipping.state || order.shipping.postcode) && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {[order.shipping.city, order.shipping.state, order.shipping.postcode].filter(Boolean).join(', ')}
                        </p>
                      )}
                      {order.shipping.country && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">{order.shipping.country}</p>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center space-x-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <Package className="h-5 w-5 text-gray-400" />
                      <p className="text-sm text-gray-500 dark:text-gray-400 italic">Same as billing address</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailsModal;