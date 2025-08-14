import React from 'react';
import { X, User, Mail, Phone, MapPin, Edit, Calendar, Building2 } from 'lucide-react';

interface CustomerDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  onEditClick: () => void;
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
const isShippingSameAsBilling = (customer: Customer): boolean => {
  const billing = customer.billing;
  const shipping = customer.shipping;
  
  return (
    billing.first_name === shipping.first_name &&
    billing.last_name === shipping.last_name &&
    billing.company === shipping.company &&
    billing.address_1 === shipping.address_1 &&
    billing.address_2 === shipping.address_2 &&
    billing.city === shipping.city &&
    billing.state === shipping.state &&
    billing.postcode === shipping.postcode &&
    billing.country === shipping.country
  );
};

const CustomerDetailsModal: React.FC<CustomerDetailsModalProps> = ({
  isOpen,
  onClose,
  customer,
  onEditClick
}) => {
  if (!isOpen || !customer) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-in fade-in-0 zoom-in-95 duration-300 border border-gray-200/20 dark:border-gray-700/20">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-blue-600 to-indigo-600 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                <User className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  Customer Details
                </h2>
                <p className="text-blue-100 text-sm">
                  {customer.first_name} {customer.last_name}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={onEditClick}
                className="p-2 hover:bg-white/20 rounded-xl transition-colors duration-200 text-white/80 hover:text-white"
                title="Edit Customer"
              >
                <Edit className="h-5 w-5" />
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-xl transition-colors duration-200 text-white/80 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center space-x-3 mb-5">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Basic Information
                </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Full Name
                  </label>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {customer.first_name} {customer.last_name}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Username
                  </label>
                  <p className="text-sm text-gray-900 dark:text-white">
                    @{customer.username}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Role
                  </label>
                  <p className="text-sm text-gray-900 dark:text-white capitalize">
                    {customer.role}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Customer Since
                  </label>
                  <div className="flex items-center text-sm text-gray-900 dark:text-white">
                    <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                    {formatDateTime(customer.date_created)}
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center space-x-3 mb-5">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <Mail className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Contact Information
                </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email Address
                  </label>
                  <div className="flex items-center text-sm text-gray-900 dark:text-white">
                    <Mail className="h-4 w-4 mr-2 text-gray-400" />
                    {customer.email}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Phone Number
                  </label>
                  <div className="flex items-center text-sm text-gray-900 dark:text-white">
                    <Phone className="h-4 w-4 mr-2 text-gray-400" />
                    {customer.billing?.phone || 'Not provided'}
                  </div>
                </div>
              </div>
            </div>

            {/* Billing Address */}
            {(customer.billing.address_1 || customer.billing.city) && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-center space-x-3 mb-5">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <Building2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Billing Address
                  </h3>
                </div>
                
                <div className="space-y-3">
                  {customer.billing.company && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Company
                      </label>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {customer.billing.company}
                      </p>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Address
                    </label>
                    <div className="space-y-1">
                      {customer.billing.address_1 && (
                        <p className="text-sm text-gray-900 dark:text-white">
                          {customer.billing.address_1}
                          {customer.billing.address_2 && `, ${customer.billing.address_2}`}
                        </p>
                      )}
                      {(customer.billing.city || customer.billing.state || customer.billing.postcode) && (
                        <p className="text-sm text-gray-900 dark:text-white">
                          {[customer.billing.city, customer.billing.state, customer.billing.postcode].filter(Boolean).join(', ')}
                        </p>
                      )}
                      {customer.billing.country && (
                        <p className="text-sm text-gray-900 dark:text-white">
                          {customer.billing.country}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Shipping Address */}
            {(() => {
              const hasShippingData = customer.shipping.address_1 || customer.shipping.city;
              const isSameAsBilling = isShippingSameAsBilling(customer);
              
              // Show shipping address if it has data OR if it's different from billing
              return (hasShippingData || !isSameAsBilling) ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                        <MapPin className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Shipping Address
                      </h3>
                    </div>
                    {isShippingSameAsBilling(customer) && (
                      <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded-full">
                        Same as billing
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    {customer.shipping.company && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Company
                        </label>
                        <p className="text-sm text-gray-900 dark:text-white">
                          {customer.shipping.company}
                        </p>
                      </div>
                    )}
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Address
                      </label>
                      <div className="space-y-1">
                        {customer.shipping.address_1 && (
                          <p className="text-sm text-gray-900 dark:text-white">
                            {customer.shipping.address_1}
                            {customer.shipping.address_2 && `, ${customer.shipping.address_2}`}
                          </p>
                        )}
                        {(customer.shipping.city || customer.shipping.state || customer.shipping.postcode) && (
                          <p className="text-sm text-gray-900 dark:text-white">
                            {[customer.shipping.city, customer.shipping.state, customer.shipping.postcode].filter(Boolean).join(', ')}
                          </p>
                        )}
                        {customer.shipping.country && (
                          <p className="text-sm text-gray-900 dark:text-white">
                            {customer.shipping.country}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null;
            })()}

            {/* Additional Information */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center space-x-3 mb-5">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <User className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Additional Information
                </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Paying Customer
                  </label>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {customer.is_paying_customer ? 'Yes' : 'No'}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Last Modified
                  </label>
                  <div className="flex items-center text-sm text-gray-900 dark:text-white">
                    <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                    {formatDateTime(customer.date_modified)}
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

export default CustomerDetailsModal; 