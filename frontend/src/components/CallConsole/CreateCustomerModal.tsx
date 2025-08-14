import React, { useState, useEffect } from 'react';
import { X, User, Mail, Phone, MapPin, Save, Loader2, UserPlus, Building2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast, Bounce, Flip } from 'react-toastify';
import api from '@/services/api';

interface CreateCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  phoneNumber?: string;
  onCustomerCreated?: (customer: any) => void;
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

const CreateCustomerModal: React.FC<CreateCustomerModalProps> = ({
  isOpen,
  onClose,
  phoneNumber,
  onCustomerCreated
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
      phone: phoneNumber || ''
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
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [billingNameOverridden, setBillingNameOverridden] = useState(false);
  const [shippingNameOverridden, setShippingNameOverridden] = useState(false);
  const queryClient = useQueryClient();

  // Update phone field when phoneNumber prop changes or modal opens
  useEffect(() => {
    if (isOpen && phoneNumber) {
      setFormData(prev => ({
        ...prev,
        billing: {
          ...prev.billing,
          phone: phoneNumber
        }
      }));
    }
  }, [isOpen, phoneNumber]);

  // Create customer mutation
  const createCustomerMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      console.log('Mutation function called with formData:', formData);
      
      // Transform form data to match backend expectations
      const customerData: any = {
        username: formData.username,
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.billing.phone,
        same_as_billing: sameAsBilling,
        // Billing address
        billing_first_name: formData.billing.first_name,
        billing_last_name: formData.billing.last_name,
        billing_address_1: formData.billing.address_1,
        billing_address_2: formData.billing.address_2,
        billing_city: formData.billing.city,
        billing_state: formData.billing.state,
        billing_postcode: formData.billing.postcode,
        billing_country: formData.billing.country,
      };

      // Add shipping address if different from billing
      if (!sameAsBilling) {
        customerData.shipping_first_name = formData.shipping.first_name;
        customerData.shipping_last_name = formData.shipping.last_name;
        customerData.shipping_address_1 = formData.shipping.address_1;
        customerData.shipping_address_2 = formData.shipping.address_2;
        customerData.shipping_city = formData.shipping.city;
        customerData.shipping_state = formData.shipping.state;
        customerData.shipping_postcode = formData.shipping.postcode;
        customerData.shipping_country = formData.shipping.country;
      }

      console.log('Sending customer data:', customerData);
      const response = await api.post('/woocom/create-customer', customerData);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success('Customer created successfully!', {
        autoClose: 4000,
        transition: Flip,
      });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      if (onCustomerCreated) {
        onCustomerCreated(data);
      }
      handleClose();
    },
    onError: (error: any) => {
      console.error('Error creating customer:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Failed to create customer';
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
      setFormData(prev => {
        if (section === 'billing') {
          return {
            ...prev,
            billing: {
              ...prev.billing,
              [subField]: value
            }
          };
        } else if (section === 'shipping') {
          return {
            ...prev,
            shipping: {
              ...prev.shipping,
              [subField]: value
            }
          };
        }
        return prev;
      });
      
      // Track when billing/shipping names are manually changed
      if (section === 'billing' && (subField === 'first_name' || subField === 'last_name')) {
        setBillingNameOverridden(true);
      }
      if (section === 'shipping' && (subField === 'first_name' || subField === 'last_name')) {
        setShippingNameOverridden(true);
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
      
      // Auto-update billing and shipping names if not overridden
      if (field === 'first_name') {
        if (!billingNameOverridden) {
          setFormData(prev => ({
            ...prev,
            billing: {
              ...prev.billing,
              first_name: value
            }
          }));
        }
        if (!shippingNameOverridden && sameAsBilling) {
          setFormData(prev => ({
            ...prev,
            shipping: {
              ...prev.shipping,
              first_name: value
            }
          }));
        }
      }
      if (field === 'last_name') {
        if (!billingNameOverridden) {
          setFormData(prev => ({
            ...prev,
            billing: {
              ...prev.billing,
              last_name: value
            }
          }));
        }
        if (!shippingNameOverridden && sameAsBilling) {
          setFormData(prev => ({
            ...prev,
            shipping: {
              ...prev.shipping,
              last_name: value
            }
          }));
        }
      }
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

  const handleSameAsBillingChange = (checked: boolean) => {
    console.log('handleSameAsBillingChange called with:', checked);
    setSameAsBilling(checked);
    if (checked) {
      // Copy billing address to shipping when checked
      setFormData(prev => {
        console.log('Copying billing to shipping (checked)');
        console.log('Current billing data:', prev.billing);
        return {
          ...prev,
          shipping: {
            ...prev.shipping,
            first_name: prev.billing.first_name,
            last_name: prev.billing.last_name,
            company: prev.billing.company,
            address_1: prev.billing.address_1,
            address_2: prev.billing.address_2,
            city: prev.billing.city,
            state: prev.billing.state,
            postcode: prev.billing.postcode,
            country: prev.billing.country
          }
        };
      });
    } else {
      // When unchecked, always populate shipping fields with current billing data
      // This ensures validation passes and user can then edit shipping fields
      setFormData(prev => {
        console.log('Populating shipping with billing data (unchecked)');
        console.log('Current billing data:', prev.billing);
        const updatedData = {
          ...prev,
          shipping: {
            ...prev.shipping,
            first_name: prev.billing.first_name,
            last_name: prev.billing.last_name,
            company: prev.billing.company,
            address_1: prev.billing.address_1,
            address_2: prev.billing.address_2,
            city: prev.billing.city,
            state: prev.billing.state,
            postcode: prev.billing.postcode,
            country: prev.billing.country
          }
        };
        console.log('Updated shipping data:', updatedData.shipping);
        return updatedData;
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
    
    // Only validate shipping address if it's different from billing
    if (!sameAsBilling) {
      console.log('Validating shipping address - sameAsBilling:', sameAsBilling);
      console.log('Shipping data:', formData.shipping);
      
      if (!formData.shipping.first_name.trim()) {
        newErrors['shipping.first_name'] = 'Shipping first name is required';
      }
      if (!formData.shipping.last_name.trim()) {
        newErrors['shipping.last_name'] = 'Shipping last name is required';
      }
      if (!formData.shipping.address_1.trim()) {
        newErrors['shipping.address_1'] = 'Shipping address is required';
      }
      if (!formData.shipping.city.trim()) {
        newErrors['shipping.city'] = 'Shipping city is required';
      }
      if (!formData.shipping.state.trim()) {
        newErrors['shipping.state'] = 'Shipping state is required';
      }
      if (!formData.shipping.postcode.trim()) {
        newErrors['shipping.postcode'] = 'Shipping postal code is required';
      }
    }

    console.log('Validation errors:', newErrors);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Submit button clicked');
    console.log('Current form data:', formData);
    console.log('Same as billing:', sameAsBilling);
    
    if (validateForm()) {
      console.log('Validation passed, calling mutation');
      createCustomerMutation.mutate(formData);
    } else {
      console.log('Validation failed');
    }
  };

  const handleClose = () => {
    setFormData({
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
        phone: phoneNumber || ''
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
    setErrors({});
    setSameAsBilling(true);
    setBillingNameOverridden(false);
    setShippingNameOverridden(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50  flex items-center justify-center p-4 z-[99999] animate-in fade-in-0 duration-300">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-in fade-in-0 zoom-in-95 duration-300 border border-gray-200/20 dark:border-gray-700/20">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-blue-600 to-indigo-600 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                <UserPlus className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  Create New Customer
                </h2>
                <p className="text-blue-100 text-sm">
                  Add customer information
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
                        handleInputChange('billing.first_name', e.target.value);
                        // Always update shipping first_name to keep it in sync with billing
                        handleInputChange('shipping.first_name', e.target.value);
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
                        handleInputChange('billing.last_name', e.target.value);
                        // Always update shipping last_name to keep it in sync with billing
                        handleInputChange('shipping.last_name', e.target.value);
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
                          handleInputChange('billing.email', e.target.value);
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

                {/* Billing Name Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {billingNameOverridden && (
                    <div className="col-span-2 mb-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                      <p className="text-xs text-yellow-700 dark:text-yellow-300">
                        Billing names have been manually overridden and will not sync with basic information.
                      </p>
                    </div>
                  )}
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
                          if (sameAsBilling) {
                            handleInputChange('shipping.address_1', e.target.value);
                          }
                        }}
                        className="w-full pl-10 pr-3 py-2.5 border-2 border-gray-200 dark:border-gray-600 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-gray-700/50 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 hover:border-gray-300 dark:hover:border-gray-500"
                        placeholder="Enter street address"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Address Line 2
                    </label>
                    <input
                      type="text"
                      value={formData.billing.address_2}
                      onChange={(e) => {
                        handleInputChange('billing.address_2', e.target.value);
                        if (sameAsBilling) {
                          handleInputChange('shipping.address_2', e.target.value);
                        }
                      }}
                      className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-600 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-gray-700/50 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 hover:border-gray-300 dark:hover:border-gray-500"
                      placeholder="Apartment, suite, etc. (optional)"
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
                        if (sameAsBilling) {
                          handleInputChange('shipping.city', e.target.value);
                        }
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
                        if (sameAsBilling) {
                          handleInputChange('shipping.state', e.target.value);
                        }
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
                        if (sameAsBilling) {
                          handleInputChange('shipping.postcode', e.target.value);
                        }
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
                      if (sameAsBilling) {
                        handleInputChange('shipping.country', e.target.value);
                      }
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
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <MapPin className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Shipping Address
                  </h3>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="sameAsBilling"
                    checked={sameAsBilling}
                    onChange={(e) => handleSameAsBillingChange(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <label htmlFor="sameAsBilling" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                    Same as billing address
                  </label>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Company (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.shipping.company}
                    onChange={(e) => handleInputChange('shipping.company', e.target.value)}
                    disabled={sameAsBilling}
                    className={`w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-600 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-gray-700/50 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 hover:border-gray-300 dark:hover:border-gray-500 ${
                      sameAsBilling ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    placeholder="Enter company name"
                  />
                </div>

                {/* Shipping Name Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {!sameAsBilling && shippingNameOverridden && (
                    <div className="col-span-2 mb-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                      <p className="text-xs text-yellow-700 dark:text-yellow-300">
                        Shipping names have been manually overridden and will not sync with billing names.
                      </p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Shipping First Name
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Optional - will use billing name if left empty
                    </p>
                    <input
                      type="text"
                      value={formData.shipping.first_name}
                      onChange={(e) => handleInputChange('shipping.first_name', e.target.value)}
                      disabled={sameAsBilling}
                      className={`w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-600 rounded-lg transition-all duration-200 dark:bg-gray-700/50 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 ${
                        sameAsBilling ? 'opacity-50 cursor-not-allowed' : errors['shipping.first_name'] ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                      placeholder="Enter shipping first name"
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
                      Shipping Last Name
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Optional - will use billing name if left empty
                    </p>
                    <input
                      type="text"
                      value={formData.shipping.last_name}
                      onChange={(e) => handleInputChange('shipping.last_name', e.target.value)}
                      disabled={sameAsBilling}
                      className={`w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-600 rounded-lg transition-all duration-200 dark:bg-gray-700/50 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 ${
                        sameAsBilling ? 'opacity-50 cursor-not-allowed' : errors['shipping.last_name'] ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                      placeholder="Enter shipping last name"
                    />
                    {errors['shipping.last_name'] && (
                      <p className="text-red-500 text-sm flex items-center space-x-1">
                        <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                        <span>{errors['shipping.last_name']}</span>
                      </p>
                    )}
                  </div>
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
                        disabled={sameAsBilling}
                        className={`w-full pl-10 pr-3 py-2.5 border-2 border-gray-200 dark:border-gray-600 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-gray-700/50 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 hover:border-gray-300 dark:hover:border-gray-500 ${
                          sameAsBilling ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        placeholder="Enter street address"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Address Line 2
                    </label>
                    <input
                      type="text"
                      value={formData.shipping.address_2}
                      onChange={(e) => handleInputChange('shipping.address_2', e.target.value)}
                      disabled={sameAsBilling}
                      className={`w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-600 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-gray-700/50 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 hover:border-gray-300 dark:hover:border-gray-500 ${
                        sameAsBilling ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      placeholder="Apartment, suite, etc. (optional)"
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
                      disabled={sameAsBilling}
                      className={`w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-600 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-gray-700/50 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 hover:border-gray-300 dark:hover:border-gray-500 ${
                        sameAsBilling ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
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
                      disabled={sameAsBilling}
                      className={`w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-600 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-gray-700/50 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 hover:border-gray-300 dark:hover:border-gray-500 ${
                        sameAsBilling ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
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
                      disabled={sameAsBilling}
                      className={`w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-600 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-gray-700/50 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 hover:border-gray-300 dark:hover:border-gray-500 ${
                        sameAsBilling ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
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
                    disabled={sameAsBilling}
                    className={`w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-600 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-gray-700/50 dark:text-white hover:border-gray-300 dark:hover:border-gray-500 ${
                      sameAsBilling ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <option value="US">🇺🇸 United States</option>
                    <option value="BD">🇧🇩 Bangladesh</option>
                    <option value="IN">🇮🇳 India</option>
                    <option value="PK">🇵🇰 Pakistan</option>
                    <option value="GB">🇬🇧 United Kingdom</option>
                    <option value="CA">🇨🇦 Canada</option>
                    <option value="AU">🇦🇺 Australia</option>
                  </select>
                </div>
              </div>
            </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-800 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors duration-200 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createCustomerMutation.isPending}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 min-w-[120px] justify-center"
            >
              {createCustomerMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Save Customer</span>
                </>
              )}
            </button>
          </div>
        </div>
          </form>
        </div>

      </div>
    </div>
  );
};

export default CreateCustomerModal;