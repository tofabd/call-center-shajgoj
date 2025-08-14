import React, { useState, useEffect } from 'react';
import { X, User, Mail, Phone, MapPin, Save, Loader2, Edit, Building2, Check } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast, Bounce, Flip } from 'react-toastify';
import api from '@/services/api';

interface EditCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: WooCommerceCustomer | null;
  onCustomerUpdated?: (customer: any) => void;
}

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

interface UpdateCustomerData {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  billing_first_name: string;
  billing_last_name: string;
  billing_email: string;
  address_1: string;
  address_2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  shipping_first_name: string;
  shipping_last_name: string;
  shipping_address_1: string;
  shipping_address_2: string;
  shipping_city: string;
  shipping_state: string;
  shipping_postcode: string;
  shipping_country: string;
}

interface FormData {
  username: string;
  first_name: string;
  last_name: string;
  email: string;
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
}

const EditCustomerModal: React.FC<EditCustomerModalProps> = ({
  isOpen,
  onClose,
  customer,
  onCustomerUpdated
}) => {
  const [formData, setFormData] = useState<FormData>({
    username: '',
    first_name: '',
    last_name: '',
    email: '',
    billing: {
      first_name: '',
      last_name: '',
      company: '',
      address_1: '',
      address_2: '',
      city: '',
      state: '',
      postcode: '',
      country: 'BD',
      email: '',
      phone: ''
    },
    shipping: {
      first_name: '',
      last_name: '',
      company: '',
      address_1: '',
      address_2: '',
      city: '',
      state: '',
      postcode: '',
      country: 'BD'
    }
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  // Populate form data when customer prop changes or modal opens
  useEffect(() => {
    if (isOpen && customer) {
      
      setFormData({
        username: customer.username || '',
        first_name: customer.first_name || '',
        last_name: customer.last_name || '',
        email: customer.email || '',
        billing: {
          first_name: customer.billing?.first_name || '',
          last_name: customer.billing?.last_name || '',
          company: customer.billing?.company || '',
          address_1: customer.billing?.address_1 || '',
          address_2: customer.billing?.address_2 || '',
          city: customer.billing?.city || '',
          state: customer.billing?.state || '',
          postcode: customer.billing?.postcode || '',
          country: customer.billing?.country || 'BD',
          email: customer.billing?.email || customer.email || '',
          phone: customer.billing?.phone || ''
        },
        shipping: {
          first_name: customer.shipping?.first_name || '',
          last_name: customer.shipping?.last_name || '',
          company: customer.shipping?.company || '',
          address_1: customer.shipping?.address_1 || '',
          address_2: customer.shipping?.address_2 || '',
          city: customer.shipping?.city || '',
          state: customer.shipping?.state || '',
          postcode: customer.shipping?.postcode || '',
          country: customer.shipping?.country || 'BD'
        }
      });
    }
  }, [isOpen, customer]);

  // Update customer mutation
  const updateCustomerMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      if (!customer) throw new Error('No customer selected');
      
      // Transform form data to match backend expectations
      const customerData: UpdateCustomerData = {
        id: customer.id,
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.billing.phone,
        billing_first_name: formData.billing.first_name,
        billing_last_name: formData.billing.last_name,
        billing_email: formData.billing.email,
        address_1: formData.billing.address_1,
        address_2: formData.billing.address_2,
        city: formData.billing.city,
        state: formData.billing.state,
        postcode: formData.billing.postcode,
        country: formData.billing.country,
        shipping_first_name: formData.shipping.first_name,
        shipping_last_name: formData.shipping.last_name,
        shipping_address_1: formData.shipping.address_1,
        shipping_address_2: formData.shipping.address_2,
        shipping_city: formData.shipping.city,
        shipping_state: formData.shipping.state,
        shipping_postcode: formData.shipping.postcode,
        shipping_country: formData.shipping.country
      };
      const response = await api.post('/woocom/update-customer', customerData);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success('Customer updated successfully!', {
        autoClose: 4000,
        transition: Flip,
      });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      if (onCustomerUpdated) {
        onCustomerUpdated(data);
      }
      handleClose();
    },
    onError: (error: any) => {
      console.error('Error updating customer:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Failed to update customer';
      const errorDetails = error.response?.data?.details || {};
      
      // Set field-specific errors if available
      if (typeof errorDetails === 'object') {
        setErrors(errorDetails);
      }
      
      toast.error(errorMessage, {
        autoClose: 5000,
        transition: Bounce,
      });
    }
  });

  const handleInputChange = (field: string, value: string) => {
    if (field.includes('.')) {
      const [section, subField] = field.split('.');
      
      if (section === 'billing') {
        setFormData(prev => ({
          ...prev,
          billing: {
            ...prev.billing,
            [subField]: value
          }
        }));
      } else if (section === 'shipping') {
        setFormData(prev => ({
          ...prev,
          shipping: {
            ...prev.shipping,
            [subField]: value
          }
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };



  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.first_name.trim()) {
      newErrors.first_name = 'First name is required';
    }
    if (!formData.last_name.trim()) {
      newErrors.last_name = 'Last name is required';
    }
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (!formData.billing.phone.trim()) {
      newErrors['billing.phone'] = 'Phone number is required';
    }
    if (!formData.billing.email.trim()) {
      newErrors['billing.email'] = 'Billing email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.billing.email)) {
      newErrors['billing.email'] = 'Please enter a valid billing email address';
    }
    if (!formData.billing.first_name.trim()) {
      newErrors['billing.first_name'] = 'Billing first name is required';
    }
    if (!formData.billing.last_name.trim()) {
      newErrors['billing.last_name'] = 'Billing last name is required';
    }
    if (!formData.shipping.first_name.trim()) {
      newErrors['shipping.first_name'] = 'Shipping first name is required';
    }
    if (!formData.shipping.last_name.trim()) {
      newErrors['shipping.last_name'] = 'Shipping last name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      updateCustomerMutation.mutate(formData);
    }
  };

  const handleClose = () => {
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50  flex items-center justify-center p-4 z-[99999] animate-in fade-in-0 duration-300">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-in fade-in-0 zoom-in-95 duration-300 border border-gray-200/20 dark:border-gray-700/20">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-green-600 to-emerald-600 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                <Edit className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  Edit Customer
                </h2>
                <p className="text-green-100 text-sm">
                  Update customer information
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-white/20 rounded-xl transition-colors duration-200 text-white/80 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <form onSubmit={handleSubmit} className="space-y-6">
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
              
              <div className="space-y-4">
                {/* First Name and Last Name in one row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={formData.first_name}
                      onChange={(e) => {
                        handleInputChange('first_name', e.target.value);
                      }}
                      className={`w-full px-3 py-2.5 border-2 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-gray-700/50 dark:border-gray-600 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 ${
                        errors.first_name ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                      placeholder="Enter first name"
                    />
                    {errors.first_name && (
                      <p className="text-red-500 text-sm flex items-center space-x-1">
                        <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                        <span>{errors.first_name}</span>
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={formData.last_name}
                      onChange={(e) => {
                        handleInputChange('last_name', e.target.value);
                      }}
                      className={`w-full px-3 py-2.5 border-2 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-gray-700/50 dark:border-gray-600 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 ${
                        errors.last_name ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                      placeholder="Enter last name"
                    />
                    {errors.last_name && (
                      <p className="text-red-500 text-sm flex items-center space-x-1">
                        <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                        <span>{errors.last_name}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Username and Email in one row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Username *
                    </label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => handleInputChange('username', e.target.value)}
                      className={`w-full px-3 py-2.5 border-2 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-gray-700/50 dark:border-gray-600 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 ${
                        errors.username ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                      placeholder="Enter username"
                    />
                    {errors.username && (
                      <p className="text-red-500 text-sm flex items-center space-x-1">
                        <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                        <span>{errors.username}</span>
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Email Address *
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => {
                          handleInputChange('email', e.target.value);
                        }}
                        className={`w-full pl-10 pr-3 py-2.5 border-2 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-gray-700/50 dark:border-gray-600 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 ${
                          errors.email ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                        }`}
                        placeholder="Enter email address"
                      />
                    </div>
                    {errors.email && (
                      <p className="text-red-500 text-sm flex items-center space-x-1">
                        <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                        <span>{errors.email}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Billing Address */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center space-x-3 mb-5">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <Building2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Billing Address
                </h3>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Phone Number *
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="tel"
                        value={formData.billing.phone}
                        onChange={(e) => handleInputChange('billing.phone', e.target.value)}
                        className={`w-full pl-10 pr-3 py-2.5 border-2 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-gray-700/50 dark:border-gray-600 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 ${
                          errors['billing.phone'] ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                        }`}
                        placeholder="Enter phone number"
                      />
                    </div>
                    {errors['billing.phone'] && (
                      <p className="text-red-500 text-sm flex items-center space-x-1">
                        <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                        <span>{errors['billing.phone']}</span>
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Billing Email *
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="email"
                        value={formData.billing.email}
                        onChange={(e) => handleInputChange('billing.email', e.target.value)}
                        className={`w-full pl-10 pr-3 py-2.5 border-2 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-gray-700/50 dark:border-gray-600 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 ${
                          errors['billing.email'] ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                        }`}
                        placeholder="Enter billing email"
                      />
                    </div>
                    {errors['billing.email'] && (
                      <p className="text-red-500 text-sm flex items-center space-x-1">
                        <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                        <span>{errors['billing.email']}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Billing First Name *
                    </label>
                    <input
                      type="text"
                      value={formData.billing.first_name}
                      onChange={(e) => handleInputChange('billing.first_name', e.target.value)}
                      className={`w-full px-3 py-2.5 border-2 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-gray-700/50 dark:border-gray-600 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 ${
                        errors['billing.first_name'] ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                      placeholder="Enter billing first name"
                    />
                    {errors['billing.first_name'] && (
                      <p className="text-red-500 text-sm flex items-center space-x-1">
                        <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                        <span>{errors['billing.first_name']}</span>
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Billing Last Name *
                    </label>
                    <input
                      type="text"
                      value={formData.billing.last_name}
                      onChange={(e) => handleInputChange('billing.last_name', e.target.value)}
                      className={`w-full px-3 py-2.5 border-2 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-gray-700/50 dark:border-gray-600 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 ${
                        errors['billing.last_name'] ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                      placeholder="Enter billing last name"
                    />
                    {errors['billing.last_name'] && (
                      <p className="text-red-500 text-sm flex items-center space-x-1">
                        <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                        <span>{errors['billing.last_name']}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Company (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.billing.company}
                    onChange={(e) => handleInputChange('billing.company', e.target.value)}
                    className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-600 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-gray-700/50 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 hover:border-gray-300 dark:hover:border-gray-500"
                    placeholder="Enter company name"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Address Line 1
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={formData.billing.address_1}
                                              onChange={(e) => {
                        handleInputChange('billing.address_1', e.target.value);
                      }}
                        className="w-full pl-10 pr-3 py-2.5 border-2 border-gray-200 dark:border-gray-600 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-gray-700/50 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 hover:border-gray-300 dark:hover:border-gray-500"
                        placeholder="Enter street address"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Address Line 2 (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.billing.address_2}
                      onChange={(e) => {
                        handleInputChange('billing.address_2', e.target.value);
                      }}
                      className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-600 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-gray-700/50 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 hover:border-gray-300 dark:hover:border-gray-500"
                      placeholder="Apartment, suite, etc."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      City
                    </label>
                    <input
                      type="text"
                      value={formData.billing.city}
                      onChange={(e) => {
                        handleInputChange('billing.city', e.target.value);
                      }}
                      className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-600 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-gray-700/50 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 hover:border-gray-300 dark:hover:border-gray-500"
                      placeholder="Enter city"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      State/Province
                    </label>
                    <input
                      type="text"
                      value={formData.billing.state}
                      onChange={(e) => {
                        handleInputChange('billing.state', e.target.value);
                      }}
                      className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-600 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-gray-700/50 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 hover:border-gray-300 dark:hover:border-gray-500"
                      placeholder="Enter state/province"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Postal Code
                    </label>
                    <input
                      type="text"
                      value={formData.billing.postcode}
                      onChange={(e) => {
                        handleInputChange('billing.postcode', e.target.value);
                      }}
                      className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-600 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-gray-700/50 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 hover:border-gray-300 dark:hover:border-gray-500"
                      placeholder="Enter postal code"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Country
                  </label>
                  <select
                    value={formData.billing.country}
                    onChange={(e) => {
                      handleInputChange('billing.country', e.target.value);
                    }}
                    className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-600 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-gray-700/50 dark:text-white hover:border-gray-300 dark:hover:border-gray-500"
                  >
                    <option value="BD">Bangladesh</option>
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="GB">United Kingdom</option>
                    <option value="AU">Australia</option>
                    <option value="IN">India</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Shipping Address */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center space-x-3 mb-5">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <MapPin className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Shipping Address
                </h3>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={formData.shipping.first_name}
                      onChange={(e) => handleInputChange('shipping.first_name', e.target.value)}
                      className={`w-full px-3 py-2.5 border-2 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-gray-700/50 dark:border-gray-600 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 hover:border-gray-300 dark:hover:border-gray-500 ${
                        errors['shipping.first_name'] ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-600'
                      }`}
                      placeholder="Enter first name"
                    />
                    {errors['shipping.first_name'] && (
                      <p className="text-red-500 text-sm flex items-center space-x-1">
                        <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                        <span>{errors['shipping.first_name']}</span>
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={formData.shipping.last_name}
                      onChange={(e) => handleInputChange('shipping.last_name', e.target.value)}
                      className={`w-full px-3 py-2.5 border-2 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-gray-700/50 dark:border-gray-600 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 hover:border-gray-300 dark:hover:border-gray-500 ${
                        errors['shipping.last_name'] ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-600'
                      }`}
                      placeholder="Enter last name"
                    />
                    {errors['shipping.last_name'] && (
                      <p className="text-red-500 text-sm flex items-center space-x-1">
                        <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                        <span>{errors['shipping.last_name']}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Company (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.shipping.company}
                    onChange={(e) => handleInputChange('shipping.company', e.target.value)}
                    className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-600 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-gray-700/50 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 hover:border-gray-300 dark:hover:border-gray-500"
                    placeholder="Enter company name"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Address Line 1
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={formData.shipping.address_1}
                        onChange={(e) => handleInputChange('shipping.address_1', e.target.value)}
                        className="w-full pl-10 pr-3 py-2.5 border-2 border-gray-200 dark:border-gray-600 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-gray-700/50 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 hover:border-gray-300 dark:hover:border-gray-500"
                        placeholder="Enter street address"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Address Line 2 (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.shipping.address_2}
                      onChange={(e) => handleInputChange('shipping.address_2', e.target.value)}
                      className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-600 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-gray-700/50 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 hover:border-gray-300 dark:hover:border-gray-500"
                      placeholder="Apartment, suite, etc."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      City
                    </label>
                    <input
                      type="text"
                      value={formData.shipping.city}
                      onChange={(e) => handleInputChange('shipping.city', e.target.value)}
                      className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-600 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-gray-700/50 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 hover:border-gray-300 dark:hover:border-gray-500"
                      placeholder="Enter city"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      State/Province
                    </label>
                    <input
                      type="text"
                      value={formData.shipping.state}
                      onChange={(e) => handleInputChange('shipping.state', e.target.value)}
                      className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-600 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-gray-700/50 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 hover:border-gray-300 dark:hover:border-gray-500"
                      placeholder="Enter state/province"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Postal Code
                    </label>
                    <input
                      type="text"
                      value={formData.shipping.postcode}
                      onChange={(e) => handleInputChange('shipping.postcode', e.target.value)}
                      className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-600 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-gray-700/50 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 hover:border-gray-300 dark:hover:border-gray-500"
                      placeholder="Enter postal code"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Country
                  </label>
                  <select
                    value={formData.shipping.country}
                    onChange={(e) => handleInputChange('shipping.country', e.target.value)}
                    className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-600 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-gray-700/50 dark:text-white hover:border-gray-300 dark:hover:border-gray-500"
                  >
                    <option value="BD">Bangladesh</option>
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="GB">United Kingdom</option>
                    <option value="AU">Australia</option>
                    <option value="IN">India</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={handleClose}
                className="px-6 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors duration-200 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateCustomerMutation.isPending}
                className="px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg transition-colors duration-200 font-medium flex items-center space-x-2 disabled:cursor-not-allowed"
              >
                {updateCustomerMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Update Customer</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditCustomerModal;