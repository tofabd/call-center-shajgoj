import React, { useState } from 'react';
import { User, Mail, MapPin, Edit } from 'lucide-react';
import type { UseQueryResult } from '@tanstack/react-query';
import CreateCustomerModal from './CreateCustomerModal';
import EditCustomerModal from './EditCustomerModal';

// WooCommerce Customer Interface
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
    self: { href: string }[];
    collection: { href: string }[];
  };
}

interface CustomerProfileProps {
  customers: WooCommerceCustomer[];
  selectedCustomer: WooCommerceCustomer | null;
  selectedCallId: number | null;
  selectedPhoneNumber: string | null;
  customersQuery: {
    data: { data: WooCommerceCustomer[]; message: string; success: boolean } | undefined;
    isLoading: boolean;
    isError: boolean;
    error?: { message?: string } | null;
    refetch: () => void;
  };
  onSelectCustomer: (customer: WooCommerceCustomer) => void;
}

// Utility function to format date and time
const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Utility function to check if shipping address is same as billing
const isShippingSameAsBilling = (customer: WooCommerceCustomer): boolean => {
  const billing = customer.billing;
  const shipping = customer.shipping;
  
  return (
    billing.address_1 === shipping.address_1 &&
    billing.address_2 === shipping.address_2 &&
    billing.city === shipping.city &&
    billing.state === shipping.state &&
    billing.postcode === shipping.postcode &&
    billing.country === shipping.country &&
    billing.company === shipping.company
  );
};

const CustomerProfile: React.FC<CustomerProfileProps> = ({
  selectedCallId,
  selectedPhoneNumber,
  customersQuery,
  customers,
  selectedCustomer,
  onCustomerSelect
}) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editCustomerModal, setEditCustomerModal] = useState(false);

  const handleCustomerCreated = (newCustomer: WooCommerceCustomer) => {
    // Refetch customers to include the newly created customer
    customersQuery.refetch();
  };
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-2 bg-green-600 rounded-lg">
          <User className="h-5 w-5 text-white" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Customer Profile</h3>
      </div>
      
      {!selectedCallId ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="h-8 w-8 text-gray-400" />
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Select a call to view customer profile</p>
        </div>
      ) : customersQuery.isLoading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      ) : customersQuery.isError && !customersQuery.data ? (
          <div className="p-8 flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-red-600 dark:text-red-400 text-sm font-medium">
                {customersQuery.error?.message || 'Failed to load customer data'}
              </p>
              <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                {typeof customersQuery.error === 'object' && customersQuery.error?.response?.data?.message 
                  ? customersQuery.error.response.data.message 
                  : 'Unable to fetch customer information for this phone number'}
              </p>
            </div>
          </div>
      ) : customers.length === 0 ? (
        <div className="p-8 flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-700 rounded-full flex items-center justify-center mx-auto mb-6">
              <User className="h-10 w-10 text-green-400" />
            </div>
            <h4 className="text-gray-900 dark:text-white font-medium text-lg mb-2">No Customer Found</h4>
            <p className="text-gray-500 dark:text-gray-400 mb-4">{customersQuery.data?.message || 'No customer found for this phone number'}</p>
            {/* Create Customer button removed as requested */}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Customer Selection (if multiple customers) */}
          {customers.length > 1 && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Multiple customers found:</h4>
              <div className="space-y-2">
                {customers.map((customer) => (
                  <button
                    key={customer.id}
                    onClick={() => onCustomerSelect(customer)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedCustomer?.id === customer.id
                        ? 'border-green-500 bg-green-100 dark:bg-green-900/40'
                        : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {customer.first_name} {customer.last_name}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{customer.email}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Selected Customer Details */}
          {selectedCustomer && (
            <div className="space-y-4">
              {/* Basic Information */}
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">Basic Information</span>
                  </div>
                  <button
                    onClick={() => setEditCustomerModal(true)}
                    className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200"
                    title="Edit Customer"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-gray-900 dark:text-white">
                    <span className="font-medium">Name:</span> {selectedCustomer.first_name} {selectedCustomer.last_name}
                  </p>
                  <p className="text-sm text-gray-900 dark:text-white">
                    <span className="font-medium">Username:</span> {selectedCustomer.username}
                  </p>
                  <p className="text-sm text-gray-900 dark:text-white">
                    <span className="font-medium">Role:</span> {selectedCustomer.role}
                  </p>
                  <p className="text-sm text-gray-900 dark:text-white">
                    <span className="font-medium">Customer Since:</span> {formatDateTime(selectedCustomer.date_created)}
                  </p>
                </div>
              </div>

              {/* Contact Information */}
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center space-x-2 mb-3">
                  <Mail className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">Contact</span>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-gray-900 dark:text-white">
                    <span className="font-medium">Email:</span> {selectedCustomer.email}
                  </p>
                  <p className="text-sm text-gray-900 dark:text-white">
                    <span className="font-medium">Phone:</span> {selectedCustomer.billing.phone}
                  </p>
                </div>
              </div>

              {/* Billing Address */}
              {(selectedCustomer.billing.address_1 || selectedCustomer.billing.city) && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="flex items-center space-x-2 mb-3">
                    <MapPin className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">Billing Address</span>
                  </div>
                  <div className="space-y-1">
                    {(selectedCustomer.billing.first_name || selectedCustomer.billing.last_name) && (
                      <p className="text-sm text-gray-900 dark:text-white font-medium">
                        {selectedCustomer.billing.first_name} {selectedCustomer.billing.last_name}
                      </p>
                    )}
                    {selectedCustomer.billing.company && (
                      <p className="text-sm text-gray-900 dark:text-white">
                        <span className="font-medium">Company:</span> {selectedCustomer.billing.company}
                      </p>
                    )}
                    {selectedCustomer.billing.address_1 && (
                      <p className="text-sm text-gray-900 dark:text-white">
                        {selectedCustomer.billing.address_1}
                        {selectedCustomer.billing.address_2 && `, ${selectedCustomer.billing.address_2}`}
                      </p>
                    )}
                    {(selectedCustomer.billing.city || selectedCustomer.billing.state || selectedCustomer.billing.postcode) && (
                      <p className="text-sm text-gray-900 dark:text-white">
                        {[selectedCustomer.billing.city, selectedCustomer.billing.state, selectedCustomer.billing.postcode].filter(Boolean).join(', ')}
                      </p>
                    )}
                    {selectedCustomer.billing.country && (
                      <p className="text-sm text-gray-900 dark:text-white">
                        {selectedCustomer.billing.country}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Shipping Address */}
              {(() => {
                const hasShippingData = selectedCustomer.shipping.address_1 || selectedCustomer.shipping.city;
                const isSameAsBilling = isShippingSameAsBilling(selectedCustomer);
                
                // Show shipping address if it has data OR if it's different from billing
                return (hasShippingData || !isSameAsBilling) ? (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">Shipping Address</span>
                    </div>
                    {isShippingSameAsBilling(selectedCustomer) && (
                      <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded-full">
                        Same as billing
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {(selectedCustomer.shipping.first_name || selectedCustomer.shipping.last_name) && (
                      <p className="text-sm text-gray-900 dark:text-white font-medium">
                        {selectedCustomer.shipping.first_name} {selectedCustomer.shipping.last_name}
                      </p>
                    )}
                    {selectedCustomer.shipping.company && (
                      <p className="text-sm text-gray-900 dark:text-white">
                        <span className="font-medium">Company:</span> {selectedCustomer.shipping.company}
                      </p>
                    )}
                    {selectedCustomer.shipping.address_1 && (
                      <p className="text-sm text-gray-900 dark:text-white">
                        {selectedCustomer.shipping.address_1}
                        {selectedCustomer.shipping.address_2 && `, ${selectedCustomer.shipping.address_2}`}
                      </p>
                    )}
                    {(selectedCustomer.shipping.city || selectedCustomer.shipping.state || selectedCustomer.shipping.postcode) && (
                      <p className="text-sm text-gray-900 dark:text-white">
                        {[selectedCustomer.shipping.city, selectedCustomer.shipping.state, selectedCustomer.shipping.postcode].filter(Boolean).join(', ')}
                      </p>
                    )}
                    {selectedCustomer.shipping.country && (
                      <p className="text-sm text-gray-900 dark:text-white">
                        {selectedCustomer.shipping.country}
                      </p>
                    )}
                  </div>
                </div>
              ) : null;
              })()}
            </div>
          )}
        </div>
      )}
      
      {/* Create Customer Modal */}
      <CreateCustomerModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        phoneNumber={selectedPhoneNumber || undefined}
        onCustomerCreated={handleCustomerCreated}
      />
      
      <EditCustomerModal
        isOpen={editCustomerModal}
        onClose={() => setEditCustomerModal(false)}
        customer={selectedCustomer}
        onCustomerUpdated={(updatedCustomer) => {
          // Optionally update the selected customer in the state
          onCustomerSelect(updatedCustomer);
        }}
      />
    </div>
  );
};

export default CustomerProfile;