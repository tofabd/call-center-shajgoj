import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Users, 
  Search, 
  Eye, 
  Edit, 
  Trash2, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  Mail,
  Phone,
  Calendar,
  Loader2
} from 'lucide-react';
import { Highlight, themes } from 'prism-react-renderer';
import api from '@services/api';
import CustomerDetailsModal from '@/components/Customers/CustomerDetailsModal';
import CustomersEditModal from '@/components/Customers/CustomersEditModal';

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
  meta_data: Record<string, unknown>[];
  _links: {
    self: Array<{ href: string }>;
    collection: Array<{ href: string }>;
  };
}

interface PaginationData {
  total: number;
  total_pages: number;
  current_page: number;
  per_page: number;
}

interface CustomersResponse {
  customers: Customer[];
  pagination: PaginationData;
}

const Customers: React.FC = () => {

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [deletingCustomerId, setDeletingCustomerId] = useState<number | null>(null);

  const perPage = 50;

  const fetchCustomers = async (page: number = 1, search: string = '') => {
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
      ...(search && { search })
    });

    const response = await api.get<CustomersResponse>(`/woocom/customers-paginated?${params}`);
    return response.data;
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['customers', currentPage, searchTerm],
    queryFn: () => fetchCustomers(currentPage, searchTerm),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const customers = data?.customers || [];
  const pagination = data?.pagination || null;

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

  const handleAction = (customer: Customer, action: 'view' | 'edit' | 'delete') => {
    setSelectedCustomer(customer);
    if (action === 'view') {
      setShowDetailsModal(true);
    } else if (action === 'edit') {
      setShowEditModal(true);
    } else if (action === 'delete') {
      setShowDeleteModal(true);
    }
  };

  const toggleRowExpansion = (customerId: number) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(customerId)) {
      newExpandedRows.delete(customerId);
    } else {
      newExpandedRows.add(customerId);
    }
    setExpandedRows(newExpandedRows);
  };

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer) return;
    
    setDeletingCustomerId(selectedCustomer.id);
    
    try {
      await api.delete(`/woocom/customers/${selectedCustomer.id}`);
      setShowDeleteModal(false);
      setSelectedCustomer(null);
      // Refresh the current page
      refetch();
    } catch (err: unknown) {
      console.error('Failed to delete customer:', err);
    } finally {
      setDeletingCustomerId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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
          Showing {from} to {to} of {pagination.total} customers
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

  const renderDeleteModal = () => {
    if (!showDeleteModal || !selectedCustomer) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Delete Customer
            </h3>
          </div>
          
          <div className="px-6 py-4">
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Are you sure you want to delete customer <strong>{selectedCustomer.first_name} {selectedCustomer.last_name}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deletingCustomerId === selectedCustomer.id}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCustomer}
                disabled={deletingCustomerId === selectedCustomer.id}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {deletingCustomerId === selectedCustomer.id ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete</span>
                )}
              </button>
            </div>
          </div>
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
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg mr-4">
                <Users className="h-7 w-7 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Customers
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Manage your customer database
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
                placeholder="Search customers by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={handleSearchKeyPress}
                className="w-full sm:w-[480px] pl-12 pr-32 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm transition-all duration-200"
              />
              <button
                onClick={handleSearch}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 px-4 py-2 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-sm"
              >
                Search
              </button>
            </div>
            
            {/* Add Customer Button */}
            <button className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-sm font-medium whitespace-nowrap">
              <Plus className="h-5 w-5 mr-2" />
              Add Customer
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <p className="text-red-600 dark:text-red-400">{error instanceof Error ? error.message : 'Failed to fetch customers'}</p>
        </div>
      )}

      {/* Customers Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">Loading customers...</span>
          </div>
        ) : customers && customers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No customers found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {customers && customers.map((customer) => (
                    <React.Fragment key={customer.id}>
                      <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
                              <span className="text-white font-medium text-sm">
                                {customer.first_name?.[0]}{customer.last_name?.[0]}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {customer.first_name} {customer.last_name}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              @{customer.username}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <div className="flex items-center text-sm text-gray-900 dark:text-white">
                            <Mail className="h-4 w-4 mr-2 text-gray-400" />
                            {customer.email}
                          </div>
                          {customer.billing?.phone && (
                            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                              <Phone className="h-4 w-4 mr-2 text-gray-400" />
                              {customer.billing.phone}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white capitalize">
                          {customer.role}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900 dark:text-white">
                          <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                          {formatDate(customer.date_created)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleAction(customer, 'view')}
                            disabled={deletingCustomerId === customer.id}
                            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 p-2 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleAction(customer, 'edit')}
                            disabled={deletingCustomerId === customer.id}
                            className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 p-2 rounded-md hover:bg-green-100 dark:hover:bg-green-900/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Edit Customer"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleAction(customer, 'delete')}
                            disabled={deletingCustomerId === customer.id}
                            className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-2 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Delete Customer"
                          >
                            {deletingCustomerId === customer.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={() => toggleRowExpansion(customer.id)}
                            disabled={deletingCustomerId === customer.id}
                            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-900/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={expandedRows.has(customer.id) ? "Hide JSON Data" : "Show JSON Data"}
                          >
                            {expandedRows.has(customer.id) ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                      </tr>
                      {expandedRows.has(customer.id) && (
                        <tr>
                          <td colSpan={5} className="px-6 py-4 bg-gray-50 dark:bg-gray-900">
                            <div className="max-w-full overflow-x-auto">
                              <div className="mb-2">
                                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  Customer JSON Data:
                                </h4>
                              </div>
                              <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
                                <Highlight
                                  theme={themes.oneDark}
                                  code={JSON.stringify(customer, null, 2)}
                                  language="json"
                                >
                                  {({ className, style, tokens, getLineProps, getTokenProps }) => (
                                    <pre
                                      className={className}
                                      style={{
                                        ...style,
                                        margin: 0,
                                        fontSize: '12px',
                                        maxHeight: '480px',
                                        overflow: 'auto',
                                        padding: '1rem'
                                      }}
                                    >
                                      {tokens.map((line, i) => (
                                        <div key={i} {...getLineProps({ line })}>
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

      {/* Modals */}
      <CustomerDetailsModal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        customer={selectedCustomer}
        onEditClick={() => {
          setShowDetailsModal(false);
          setShowEditModal(true);
        }}
      />
      
      <CustomersEditModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        customer={selectedCustomer}
        onCustomerUpdated={() => {
          // Refresh the current page
          refetch();
        }}
      />
      
      {renderDeleteModal()}
    </div>
  );
};

export default Customers;