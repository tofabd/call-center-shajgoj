import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  TestTube,
  CheckCircle,
  XCircle,
  Loader2,
  Search,
  Users,
  ShoppingCart,
  Package,
  Phone,
  Calendar,
  DollarSign,
  User,
  MapPin
} from 'lucide-react';
import api from '@services/api';

// Types based on WooCommerce API responses
interface Product {
  id: number;
  name: string;
  price: string;
  regular_price: string;
  sale_price: string;
  status: string;
  description: string;
  images: Array<{ src: string }>;
  sku: string;
  stock_quantity: number;
  stock_status: 'instock' | 'outofstock';
}

interface ConnectionResult {
  success: boolean;
  message: string;
}

// Order interfaces based on WooCommerce API
interface OrderLineItem {
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
  meta_data: Array<{
    key: string;
    value: string;
  }>;
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
  date_created: string;
  date_created_gmt: string;
  total: string;
  billing: OrderBilling;
  shipping: OrderShipping;
  line_items: OrderLineItem[];
  _links: {
    self: { href: string };
    collection: { href: string };
  };
}

// Customer interfaces based on WooCommerce API
interface CustomerBilling {
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

interface CustomerShipping {
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

interface Customer {
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
  billing: CustomerBilling;
  shipping: CustomerShipping;
  is_paying_customer: boolean;
  avatar_url: string;
  meta_data: Array<{
    key: string;
    value: string;
  }>;
  _links: {
    self: { href: string };
    collection: { href: string };
  };
}

const Test: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'connection' | 'orders' | 'products' | 'users'>('connection');
  const [searchQuery, setSearchQuery] = useState('');
  const [phoneSearch, setPhoneSearch] = useState('');
  
  // Pagination state for products
  const [currentPage, setCurrentPage] = useState(1);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [hasMoreProducts, setHasMoreProducts] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);

  // Connection Test state (using normal state instead of React Query)
  const [connectionData, setConnectionData] = useState<ConnectionResult | null>(null);
  const [connectionLoading, setConnectionLoading] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Function to handle connection test
  const handleConnectionTest = async () => {
    if (activeTab !== 'connection') {
      setActiveTab('connection');
      return;
    }

    setConnectionLoading(true);
    setConnectionError(null);

    try {
      const response = await api.get('/woocom/test/connection');
      setConnectionData(response.data);
    } catch (error: any) {
      console.error('Error testing connection:', error);
      setConnectionError('Failed to test connection. Please try again.');
      setConnectionData(null);
    } finally {
      setConnectionLoading(false);
    }
  };

  // Test connection when switching to connection tab
  useEffect(() => {
    if (activeTab === 'connection' && !connectionData && !connectionLoading) {
      handleConnectionTest();
    }
  }, [activeTab]);

  // Search Products with pagination (keeping React Query)
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['woocom-search-products', searchQuery, currentPage],
    queryFn: async (): Promise<Product[]> => {
      const response = await api.get('/woocom/test/search-products', {
        params: { q: searchQuery, page: currentPage, per_page: 15 }
      });
      return response.data;
    },
    enabled: searchQuery.length > 2 && activeTab === 'products'
  });

  // Orders Search with React Query
  const { data: orders = [], isLoading: ordersLoading, error: ordersError } = useQuery({
    queryKey: ['woocom-orders', phoneSearch],
    queryFn: async (): Promise<Order[]> => {
      const response = await api.get(`/woocom/orders/${encodeURIComponent(phoneSearch)}`);
      return response.data || [];
    },
    enabled: phoneSearch.length >= 3 && activeTab === 'orders',
    staleTime: 30000, // 30 seconds
    retry: 2
  });

  // Users Search with React Query
  const { data: customers = [], isLoading: customersLoading, error: customersError } = useQuery({
    queryKey: ['woocom-customers', phoneSearch],
    queryFn: async (): Promise<Customer[]> => {
      const response = await api.get(`/woocom/test/customers/${encodeURIComponent(phoneSearch)}`);
      return response.data || [];
    },
    enabled: phoneSearch.length >= 3 && activeTab === 'users',
    staleTime: 30000, // 30 seconds
    retry: 2
  });

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const handleIntersection = async (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting && hasMoreProducts && !isLoadingMore && searchQuery.length > 2) {
        setIsLoadingMore(true);
        try {
          const response = await api.get('/woocom/test/search-products', {
            params: { q: searchQuery, page: currentPage + 1, per_page: 15 }
          });
          
          const newProducts = response.data;
          if (newProducts.length === 0) {
            setHasMoreProducts(false);
          } else {
            setAllProducts(prev => [...prev, ...newProducts]);
            setCurrentPage(prev => prev + 1);
          }
        } catch (error) {
          console.error('Error loading more products:', error);
        } finally {
          setIsLoadingMore(false);
        }
      }
    };

    const observer = new IntersectionObserver(handleIntersection, { threshold: 0.1 });

    if (loaderRef.current && hasMoreProducts && allProducts.length > 0) {
      observer.observe(loaderRef.current);
    }

    return () => {
      if (loaderRef.current) {
        observer.unobserve(loaderRef.current);
      }
    };
  }, [hasMoreProducts, isLoadingMore, searchQuery, allProducts.length, currentPage]);

  // Reset pagination when search query changes
  useEffect(() => {
    setCurrentPage(1);
    setAllProducts([]);
    setHasMoreProducts(true);
    setIsLoadingMore(false);
  }, [searchQuery]);

  // Update allProducts when searchResults change
  useEffect(() => {
    if (searchResults) {
      if (currentPage === 1) {
        setAllProducts(searchResults);
      }
      if (searchResults.length < 15) {
        setHasMoreProducts(false);
      }
    }
  }, [searchResults, currentPage]);

  const buttons = [
    { id: 'connection', label: 'Connection Test', icon: TestTube, color: 'bg-blue-500 hover:bg-blue-600' },
    { id: 'orders', label: 'Orders Search', icon: ShoppingCart, color: 'bg-green-500 hover:bg-green-600' },
    { id: 'products', label: 'Products Search', icon: Package, color: 'bg-purple-500 hover:bg-purple-600' },
    { id: 'users', label: 'Users Search', icon: Users, color: 'bg-orange-500 hover:bg-orange-600' }
  ];

  return (
    <div className="w-full p-4 lg:p-6 space-y-6">
      {/* Page Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">WooCommerce Test</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Test WooCommerce API integration and search endpoints
        </p>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {buttons.map((button) => {
          const Icon = button.icon;
          return (
            <button
              key={button.id}
              onClick={() => {
                if (button.id === 'connection') {
                  handleConnectionTest();
                } else {
                  setActiveTab(button.id as any);
                }
              }}
              className={`flex items-center justify-center gap-3 py-4 px-6 text-white rounded-lg font-medium transition-all transform hover:scale-105 shadow-lg ${
                activeTab === button.id
                  ? `${button.color} ring-4 ring-opacity-50 ring-white`
                  : `${button.color} opacity-80`
              }`}
            >
              <Icon className="h-5 w-5" />
              {button.label}
            </button>
          );
        })}
      </div>

      {/* Connection Test Tab */}
      {activeTab === 'connection' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Connection Status</h2>
          
          {connectionLoading ? (
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              Testing connection...
            </div>
          ) : connectionError ? (
            <div className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 p-4 rounded-lg flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              <span>{connectionError}</span>
            </div>
          ) : connectionData ? (
            <div className={`flex items-center gap-2 p-4 rounded-lg ${
              connectionData.success 
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
            }`}>
              {connectionData.success ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <XCircle className="h-5 w-5" />
              )}
              <span className="font-medium">{connectionData.message}</span>
            </div>
          ) : (
            <div className="text-gray-500 dark:text-gray-400">Click refresh to test connection</div>
          )}
        </div>
      )}

      {/* Orders Search Tab */}
      {activeTab === 'orders' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center justify-center gap-2">
            <ShoppingCart className="h-5 w-5 text-green-500" />
            Search Orders by Phone
          </h3>
          <div className="flex justify-center">
            <div className="w-full sm:w-3/4 md:w-1/2 relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Enter phone number to search orders..."
                value={phoneSearch}
                onChange={(e) => setPhoneSearch(e.target.value)}
                className="w-full pl-10 pr-12 py-3 border border-green-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white"
              />
              {ordersLoading && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-green-500" />
                </div>
              )}
            </div>
          </div>

          {/* Orders Results */}
          {phoneSearch.length >= 3 && (
            <div className="mt-6">
              {ordersLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="text-sm font-medium">Searching orders...</span>
                  </div>
                </div>
              )}

              {ordersError && (
                <div className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 p-4 rounded-lg flex items-center gap-2">
                  <XCircle className="h-5 w-5" />
                  <span>Failed to fetch orders. Please try again.</span>
                </div>
              )}

              {!ordersLoading && !ordersError && orders.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    Found {orders.length} order{orders.length !== 1 ? 's' : ''} for phone: {phoneSearch}
                  </h4>
                  <div className="space-y-4">
                    {orders.map((order) => (
                      <div key={order.id} className="p-6 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900 dark:to-green-800 rounded-lg border border-green-200 dark:border-green-700">
                        {/* Order Header */}
                        <div className="flex flex-wrap items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <h5 className="text-lg font-semibold text-green-800 dark:text-green-200">
                              Order #{order.id}
                            </h5>
                            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                              order.status === 'completed' ? 'bg-green-500 text-white' :
                              order.status === 'processing' ? 'bg-blue-500 text-white' :
                              order.status === 'on-hold' ? 'bg-yellow-500 text-white' :
                              order.status === 'cancelled' ? 'bg-red-500 text-white' :
                              'bg-gray-500 text-white'
                            }`}>
                              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-green-700 dark:text-green-300">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {new Date(order.date_created).toLocaleDateString()}
                            </div>
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-4 w-4" />
                              <span className="font-semibold">${order.total}</span>
                            </div>
                          </div>
                        </div>

                        {/* Customer Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div className="space-y-2">
                            <h6 className="font-medium text-green-800 dark:text-green-200 flex items-center gap-2">
                              <User className="h-4 w-4" />
                              Customer Information
                            </h6>
                            <div className="text-sm text-green-700 dark:text-green-300 space-y-1">
                              <div><strong>Name:</strong> {order.billing.first_name} {order.billing.last_name}</div>
                              <div><strong>Email:</strong> {order.billing.email}</div>
                              <div><strong>Phone:</strong> {order.billing.phone}</div>
                              {order.billing.company && <div><strong>Company:</strong> {order.billing.company}</div>}
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <h6 className="font-medium text-green-800 dark:text-green-200 flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              Billing Address
                            </h6>
                            <div className="text-sm text-green-700 dark:text-green-300">
                              <div>{order.billing.address_1}</div>
                              {order.billing.address_2 && <div>{order.billing.address_2}</div>}
                              <div>{order.billing.city}, {order.billing.state} {order.billing.postcode}</div>
                              <div>{order.billing.country}</div>
                            </div>
                          </div>
                        </div>

                        {/* Shipping Address */}
                        {(order.shipping.address_1 || order.shipping.city) && (
                          <div className="mb-4">
                            <h6 className="font-medium text-green-800 dark:text-green-200 flex items-center gap-2 mb-2">
                              <MapPin className="h-4 w-4" />
                              Shipping Address
                            </h6>
                            <div className="text-sm text-green-700 dark:text-green-300">
                              <div>{order.shipping.first_name} {order.shipping.last_name}</div>
                              {order.shipping.company && <div>{order.shipping.company}</div>}
                              <div>{order.shipping.address_1}</div>
                              {order.shipping.address_2 && <div>{order.shipping.address_2}</div>}
                              <div>{order.shipping.city}, {order.shipping.state} {order.shipping.postcode}</div>
                              <div>{order.shipping.country}</div>
                            </div>
                          </div>
                        )}

                        {/* Order Items */}
                        {order.line_items && order.line_items.length > 0 && (
                          <div>
                            <h6 className="font-medium text-green-800 dark:text-green-200 flex items-center gap-2 mb-3">
                              <Package className="h-4 w-4" />
                              Order Items ({order.line_items.length})
                            </h6>
                            <div className="space-y-2">
                              {order.line_items.map((item) => (
                                <div key={item.id} className="flex justify-between items-center p-3 bg-white dark:bg-gray-700 rounded border">
                                  <div className="flex-1">
                                    <div className="font-medium text-gray-900 dark:text-white">{item.name}</div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                      SKU: {item.sku || 'N/A'} | Qty: {item.quantity}
                                    </div>
                                    {item.meta_data && item.meta_data.length > 0 && (
                                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {item.meta_data.map((meta, index) => (
                                          <span key={index} className="mr-2">
                                            {meta.key}: {meta.value}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <div className="font-semibold text-gray-900 dark:text-white">${item.total}</div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">${item.price} each</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!ordersLoading && !ordersError && orders.length === 0 && phoneSearch.length >= 3 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No orders found for phone number: {phoneSearch}</p>
                </div>
              )}
            </div>
          )}

          {phoneSearch.length < 3 && phoneSearch.length > 0 && (
            <div className="mt-6 text-center py-4 text-gray-500 dark:text-gray-400">
              <p>Please enter at least 3 characters to search</p>
            </div>
          )}
        </div>
      )}

      {/* Products Search Tab */}
      {activeTab === 'products' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center justify-center gap-2">
            <Package className="h-5 w-5 text-purple-500" />
            Search Products
          </h3>
          <div className="flex justify-center">
            <div className="w-full sm:w-3/4 md:w-1/2 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search products by name, SKU, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-12 py-3 border border-purple-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
              />
              {searchLoading && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                </div>
              )}
            </div>
          </div>
          
          {allProducts && allProducts.length > 0 && (
            <div className="mt-6 space-y-4">
              <h4 className="font-medium text-gray-900 dark:text-white">Found {allProducts.length} products{hasMoreProducts ? '+' : ''}:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allProducts.map((product) => (
                  <div key={product.id} className="p-4 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900 dark:to-purple-800 rounded-lg border border-purple-200 dark:border-purple-700">
                    {product.images && product.images.length > 0 && (
                      <img 
                        src={product.images[0].src} 
                        alt={product.name}
                        className="w-full h-60 object-cover rounded-lg mb-3"
                      />
                    )}
                    <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-2">{product.name}</h4>
                    <div className="text-sm text-purple-700 dark:text-purple-300 space-y-1">
                      <div>SKU: <span className="font-medium">{product.sku}</span></div>
                      <div>Price: <span className="font-medium">{product.price}</span></div>
                      <div>Stock: <span className="font-medium">{product.stock_quantity}</span></div>
                      <div className="flex justify-between items-center mt-2">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          product.stock_status === 'instock' 
                            ? 'bg-green-500 text-white'
                            : 'bg-red-500 text-white'
                        }`}>
                          {product.stock_status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Infinite Scroll Loader */}
              {hasMoreProducts && allProducts.length > 0 && (
                <div ref={loaderRef} className="flex justify-center py-8">
                  <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="text-sm font-medium">
                      {isLoadingMore ? 'Loading more products...' : 'Scroll to load more'}
                    </span>
                  </div>
                </div>
              )}
              
              {/* End of results indicator */}
              {!hasMoreProducts && allProducts.length > 0 && (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">No more products to load</p>
                </div>
              )}
            </div>
          )}
          
          {searchQuery.length > 2 && allProducts && allProducts.length === 0 && !searchLoading && (
            <div className="mt-6 text-center py-8 text-gray-500 dark:text-gray-400">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No products found for your search</p>
            </div>
          )}
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center justify-center gap-2">
            <Users className="h-5 w-5 text-orange-500" />
            Search Users by Phone
          </h3>
          <div className="flex justify-center">
            <div className="w-full sm:w-3/4 md:w-1/2 relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Enter phone number to search users..."
                value={phoneSearch}
                onChange={(e) => setPhoneSearch(e.target.value)}
                className="w-full pl-10 pr-12 py-3 border border-orange-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-white"
              />
              {customersLoading && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                </div>
              )}
            </div>
          </div>

          {/* Customer Results */}
          {phoneSearch.length >= 3 && (
            <div className="mt-6">
              {customersLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="text-sm font-medium">Searching customers...</span>
                  </div>
                </div>
              )}

              {customersError && (
                <div className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 p-4 rounded-lg flex items-center gap-2">
                  <XCircle className="h-5 w-5" />
                  <span>Failed to fetch customers. Please try again.</span>
                </div>
              )}

              {!customersLoading && !customersError && customers.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    Found {customers.length} customer{customers.length !== 1 ? 's' : ''} for phone: {phoneSearch}
                  </h4>
                  <div className="space-y-4">
                    {customers.map((customer) => (
                      <div key={customer.id} className="p-6 bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900 dark:to-orange-800 rounded-lg border border-orange-200 dark:border-orange-700">
                        {/* Customer Header */}
                        <div className="flex flex-wrap items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center text-white font-semibold text-lg">
                              {customer.first_name.charAt(0)}{customer.last_name.charAt(0)}
                            </div>
                            <div>
                              <h5 className="text-lg font-semibold text-orange-800 dark:text-orange-200">
                                {customer.first_name} {customer.last_name}
                              </h5>
                              <p className="text-sm text-orange-600 dark:text-orange-400">@{customer.username}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-orange-700 dark:text-orange-300">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {new Date(customer.date_created).toLocaleDateString()}
                            </div>
                            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                              customer.is_paying_customer ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'
                            }`}>
                              {customer.is_paying_customer ? 'Paying Customer' : 'Non-Paying'}
                            </span>
                          </div>
                        </div>

                        {/* Customer Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div className="space-y-2">
                            <h6 className="font-medium text-orange-800 dark:text-orange-200 flex items-center gap-2">
                              <User className="h-4 w-4" />
                              Contact Information
                            </h6>
                            <div className="text-sm text-orange-700 dark:text-orange-300 space-y-1">
                              <div><strong>Email:</strong> {customer.email}</div>
                              <div><strong>Phone:</strong> {customer.billing.phone}</div>
                              <div><strong>Role:</strong> {customer.role}</div>
                              {customer.billing.company && <div><strong>Company:</strong> {customer.billing.company}</div>}
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <h6 className="font-medium text-orange-800 dark:text-orange-200 flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              Billing Address
                            </h6>
                            <div className="text-sm text-orange-700 dark:text-orange-300">
                              <div>{customer.billing.address_1}</div>
                              {customer.billing.address_2 && <div>{customer.billing.address_2}</div>}
                              <div>{customer.billing.city}, {customer.billing.state} {customer.billing.postcode}</div>
                              <div>{customer.billing.country}</div>
                            </div>
                          </div>
                        </div>

                        {/* Shipping Address */}
                        {(customer.shipping.address_1 || customer.shipping.city) && (
                          <div className="mb-4">
                            <h6 className="font-medium text-orange-800 dark:text-orange-200 flex items-center gap-2 mb-2">
                              <MapPin className="h-4 w-4" />
                              Shipping Address
                            </h6>
                            <div className="text-sm text-orange-700 dark:text-orange-300">
                              <div>{customer.shipping.first_name} {customer.shipping.last_name}</div>
                              {customer.shipping.company && <div>{customer.shipping.company}</div>}
                              <div>{customer.shipping.address_1}</div>
                              {customer.shipping.address_2 && <div>{customer.shipping.address_2}</div>}
                              <div>{customer.shipping.city}, {customer.shipping.state} {customer.shipping.postcode}</div>
                              <div>{customer.shipping.country}</div>
                            </div>
                          </div>
                        )}

                        {/* Customer Meta Data */}
                        {customer.meta_data && customer.meta_data.length > 0 && (
                          <div>
                            <h6 className="font-medium text-orange-800 dark:text-orange-200 mb-2">
                              Additional Information
                            </h6>
                            <div className="text-sm text-orange-700 dark:text-orange-300 space-y-1">
                              {customer.meta_data.map((meta, index) => (
                                <div key={index}>
                                  <strong>{meta.key}:</strong> {meta.value}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!customersLoading && !customersError && customers.length === 0 && phoneSearch.length >= 3 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No customers found for phone number: {phoneSearch}</p>
                </div>
              )}
            </div>
          )}

          {phoneSearch.length < 3 && phoneSearch.length > 0 && (
            <div className="mt-6 text-center py-4 text-gray-500 dark:text-gray-400">
              <p>Please enter at least 3 characters to search</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Test;