import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  ShoppingCart, 
  Search, 
  Eye, 
  Edit, 
  Trash2, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  Package,
  DollarSign,
  Calendar,
  User,
  Phone
} from 'lucide-react';
import { Highlight, themes } from 'prism-react-renderer';
import api from '@services/api';

interface OrderLineItem {
  id: number;
  product_id: number;
  name: string;
  quantity: number;
  price: string;
  total: string;
}

interface OrderBilling {
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
}

interface OrderShipping {
  first_name: string;
  last_name: string;
  company: string;
  address_1: string;
  address_2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
}

interface Order {
  id: number;
  status: string;
  total: string;
  date_created: string;
  customer_name: string;
  items_count: number;
  billing: OrderBilling;
  shipping: OrderShipping;
  line_items: OrderLineItem[];
}

interface OrderStats {
  total_count: number;
  total_revenue: number;
  completed_count: number;
  processing_count: number;
  on_hold_count: number;
  cancelled_count: number;
}

interface PaginationData {
  total: number;
  total_pages: number;
  current_page: number;
  per_page: number;
}

interface OrdersResponse {
  orders: Order[];
  pagination: PaginationData;
  stats: OrderStats;
}

const Orders: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'view' | 'edit' | 'delete'>('view');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const perPage = 50;

  const fetchOrders = async (page: number = 1, search: string = '') => {
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
      ...(search && { search })
    });

    const response = await api.get<OrdersResponse>(`/woocom/orders-paginated?${params}`);
    return response.data;
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['orders', currentPage, searchTerm],
    queryFn: () => fetchOrders(currentPage, searchTerm),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const orders = data?.orders || [];
  const pagination = data?.pagination || null;
  const stats = data?.stats || null;

  const handleSearch = () => {
    setCurrentPage(1);
    refetch();
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleAction = (order: Order, action: 'view' | 'edit' | 'delete') => {
    setSelectedOrder(order);
    setModalType(action);
    setShowModal(true);
  };

  const toggleRowExpansion = (orderId: number) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(orderId)) {
      newExpandedRows.delete(orderId);
    } else {
      newExpandedRows.add(orderId);
    }
    setExpandedRows(newExpandedRows);
  };

  const handleDeleteOrder = async () => {
    if (!selectedOrder) return;
    
    try {
      await api.delete(`/woocom/orders/${selectedOrder.id}`);
      setShowModal(false);
      setSelectedOrder(null);
      // Refresh the current page
      refetch();
    } catch (err: any) {
      console.error('Failed to delete order:', err);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(parseFloat(amount));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'processing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'on-hold':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'pending':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const renderPagination = () => {
    if (!pagination) return null;

    const { current_page, total_pages } = pagination;
    const pages = [];
    
    // Show first page
    if (current_page > 3) {
      pages.push(1);
      if (current_page > 4) pages.push('...');
    }
    
    // Show pages around current page
    for (let i = Math.max(1, current_page - 2); i <= Math.min(total_pages, current_page + 2); i++) {
      pages.push(i);
    }
    
    // Show last page
    if (current_page < total_pages - 2) {
      if (current_page < total_pages - 3) pages.push('...');
      pages.push(total_pages);
    }

    const from = (current_page - 1) * pagination.per_page + 1;
    const to = Math.min(current_page * pagination.per_page, pagination.total);

    return (
      <div className="flex items-center justify-between px-6 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center text-sm text-gray-700 dark:text-gray-300">
          Showing {from} to {to} of {pagination.total} orders
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handlePageChange(current_page - 1)}
            disabled={current_page === 1}
            className="p-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          
          {pages.map((page, index) => (
            <button
              key={index}
              onClick={() => typeof page === 'number' ? handlePageChange(page) : null}
              disabled={page === '...'}
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                page === current_page
                  ? 'bg-blue-500 text-white'
                  : page === '...'
                  ? 'text-gray-400 cursor-default'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              {page}
            </button>
          ))}
          
          <button
            onClick={() => handlePageChange(current_page + 1)}
            disabled={current_page === total_pages}
            className="p-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full p-4 lg:p-6 space-y-6">
      {/* Header with Title, Search, and Add Button */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Title Section */}
          <div className="flex items-center">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg mr-4">
                <ShoppingCart className="h-7 w-7 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Orders
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Manage your order database
                </p>
              </div>
            </div>
          </div>
          
          {/* Search and Action Section */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Enhanced Search Box */}
            <div className="relative flex-1 sm:flex-none">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search orders by ID, customer name, or status..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={handleSearchKeyPress}
                className="w-full sm:w-[480px] pl-12 pr-32 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent shadow-sm transition-all duration-200"
              />
              <button
                onClick={handleSearch}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 px-4 py-2 bg-green-500 text-white rounded-md text-sm font-medium hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-200 shadow-sm"
              >
                Search
              </button>
            </div>
            
            {/* Add Order Button */}
            <button className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-200 shadow-sm font-medium whitespace-nowrap">
              <Plus className="h-5 w-5 mr-2" />
              Add Order
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <ShoppingCart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Orders</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{stats.total_count}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Revenue</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{formatCurrency(stats.total_revenue.toString())}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Package className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Completed</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{stats.completed_count}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Processing</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{stats.processing_count}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <p className="text-red-600 dark:text-red-400">{error instanceof Error ? error.message : 'Failed to fetch orders'}</p>
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">Loading orders...</span>
          </div>
        ) : orders && orders.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No orders found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Order
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Phone
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Items
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {orders && orders.map((order) => (
                    <React.Fragment key={order.id}>
                      <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                              <ShoppingCart className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              #{order.id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <User className="h-4 w-4 text-gray-400 mr-2" />
                          <div className="text-sm text-gray-900 dark:text-white">{order.customer_name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Phone className="h-4 w-4 text-gray-400 mr-2" />
                          <div className="text-sm text-gray-900 dark:text-white">{order.billing?.phone || 'N/A'}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full capitalize ${getStatusColor(order.status)}`}>
                          {order.status.replace('-', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <DollarSign className="h-4 w-4 text-gray-400 mr-1" />
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(order.total)}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Package className="h-4 w-4 text-gray-400 mr-2" />
                          <div className="text-sm text-gray-900 dark:text-white">{order.items_count} items</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                          <div className="text-sm text-gray-900 dark:text-white">{formatDate(order.date_created)}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleAction(order, 'view')}
                            className="p-2 rounded-md text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
                            title="View order"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleAction(order, 'edit')}
                            className="p-2 rounded-md text-green-600 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900/30 transition-colors"
                            title="Edit order"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleAction(order, 'delete')}
                            className="p-2 rounded-md text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors"
                            title="Delete order"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => toggleRowExpansion(order.id)}
                            className="p-2 rounded-md text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900/30 transition-all duration-200"
                            title={expandedRows.has(order.id) ? "Hide JSON Data" : "Show JSON Data"}
                          >
                            {expandedRows.has(order.id) ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                      </tr>
                      {expandedRows.has(order.id) && (
                        <tr>
                          <td colSpan={8} className="px-6 py-4 bg-gray-50 dark:bg-gray-900 w-full">
                            <div className="w-full overflow-x-auto">
                              <div className="mb-2">
                                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  Order JSON Data:
                                </h4>
                              </div>
                              <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 w-full">
                                <Highlight
                                  theme={themes.oneDark}
                                  code={JSON.stringify(order, null, 2)}
                                  language="json"
                                >
                                  {({ className, style, tokens, getLineProps, getTokenProps }) => (
                                    <pre
                                      className={`${className} w-full`}
                                      style={{
                                        ...style,
                                        margin: 0,
                                        fontSize: '12px',
                                        maxHeight: '480px',
                                        overflow: 'auto',
                                        padding: '1rem',
                                        width: '100%'
                                      }}
                                    >
                                      {tokens.map((line, i) => (
                                        <div key={i} {...getLineProps({ line })} className="w-full">
                                          <span style={{ display: 'inline-block', width: '2em', userSelect: 'none', opacity: 0.5 }}>
                                            {i + 1}
                                          </span>
                                          {line.map((token, key) => (
                                            <span key={key} {...getTokenProps({ token })} />
                                          ))}
                                        </div>
                                      ))}
                                    </pre>
                                  )}
                                </Highlight>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            {renderPagination()}
          </>
        )}
      </div>

      {/* Modal for View/Edit/Delete */}
      {showModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  {modalType === 'view' ? 'View Order' : modalType === 'edit' ? 'Edit Order' : 'Delete Order'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ×
                </button>
              </div>
              
              {modalType === 'delete' ? (
                <div>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Are you sure you want to delete order #{selectedOrder.id}? This action cannot be undone.
                  </p>
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => setShowModal(false)}
                      className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteOrder}
                      className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Order ID</label>
                      <p className="text-sm text-gray-900 dark:text-white">#{selectedOrder.id}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full capitalize ${getStatusColor(selectedOrder.status)}`}>
                        {selectedOrder.status.replace('-', ' ')}
                      </span>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Customer</label>
                      <p className="text-sm text-gray-900 dark:text-white">{selectedOrder.customer_name}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Total</label>
                      <p className="text-sm text-gray-900 dark:text-white">{formatCurrency(selectedOrder.total)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Items Count</label>
                      <p className="text-sm text-gray-900 dark:text-white">{selectedOrder.items_count} items</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date Created</label>
                      <p className="text-sm text-gray-900 dark:text-white">{formatDate(selectedOrder.date_created)}</p>
                    </div>
                  </div>
                  
                  {selectedOrder.line_items && selectedOrder.line_items.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Order Items</label>
                      <div className="border border-gray-200 dark:border-gray-600 rounded-md">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                          <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Product</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Qty</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Price</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Total</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                            {selectedOrder.line_items.map((item) => (
                              <tr key={item.id}>
                                <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{item.name}</td>
                                <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{item.quantity}</td>
                                <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{formatCurrency(item.price)}</td>
                                <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{formatCurrency(item.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => setShowModal(false)}
                      className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Close
                    </button>
                    {modalType === 'edit' && (
                      <button className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600">
                        Save Changes
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;