import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { Calendar, User, Tag, Edit3, X } from 'lucide-react';
import type { CustomerFollowUp, CreateFollowUpData, UpdateFollowUpData } from '../types/followUp';
import FollowUpList from '../components/FollowUp/FollowUpList';
import CreateFollowUpModal from '../components/FollowUp/CreateFollowUpModal';
import EditFollowUpModal from '../components/FollowUp/EditFollowUpModal';
import { createFollowUp, updateFollowUp } from '../services/followUpService';
import { useQueryClient } from '@tanstack/react-query';

const FollowUps: React.FC = () => {
  const [selectedFollowUp, setSelectedFollowUp] = useState<CustomerFollowUp | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleCreateNew = () => {
    setShowCreateModal(true);
  };

  const handleViewFollowUp = (followUp: CustomerFollowUp) => {
    setSelectedFollowUp(followUp);
    setShowDetailsModal(true);
  };

  const handleEditFollowUp = (followUp: CustomerFollowUp) => {
    setSelectedFollowUp(followUp);
    setShowEditModal(true);
  };

  const handleDeleteFollowUp = async (followUp: CustomerFollowUp) => {
    if (window.confirm(`Are you sure you want to delete the follow-up "${followUp.title}"?`)) {
      try {
        // TODO: Implement delete functionality
        toast.success('Follow-up deleted successfully');
        queryClient.invalidateQueries({ queryKey: ['followUps'] });
      } catch {
        toast.error('Failed to delete follow-up');
      }
    }
  };

  const handleCompleteFollowUp = async (followUp: CustomerFollowUp) => {
    try {
      // TODO: Implement complete functionality for followUp.id
      console.log('Completing follow-up:', followUp.id);
      toast.success('Follow-up marked as completed');
      queryClient.invalidateQueries({ queryKey: ['followUps'] });
    } catch {
      toast.error('Failed to complete follow-up');
    }
  };

  const handleCallCustomer = (phoneNumber: string) => {
    // TODO: Integrate with call system
    toast.info(`Calling ${phoneNumber}...`);
  };

  const closeModals = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setShowDetailsModal(false);
    setSelectedFollowUp(null);
  };

  // Create follow-up handler
  const handleCreateFollowUp = async (data: CreateFollowUpData) => {
    setCreateLoading(true);
    try {
      console.log('Creating follow-up with data:', data);
      await createFollowUp(data);
      toast.success('Follow-up created successfully');
      setShowCreateModal(false);
      queryClient.invalidateQueries({ queryKey: ['followUps'] });
    } catch (error: unknown) {
      console.error('Error creating follow-up:', error);
      
      // Handle axios error response
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } };
        if (axiosError.response?.data?.errors) {
          // Display validation errors
          const validationErrors = axiosError.response.data.errors;
          Object.keys(validationErrors).forEach(field => {
            toast.error(`${field}: ${validationErrors[field].join(', ')}`);
          });
        } else if (axiosError.response?.data?.message) {
          toast.error(axiosError.response.data.message);
        } else {
          toast.error('Failed to create follow-up');
        }
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Failed to create follow-up';
        toast.error(errorMessage);
      }
    } finally {
      setCreateLoading(false);
    }
  };

  // Edit follow-up handler
  const handleEditFollowUpSubmit = async (data: CreateFollowUpData) => {
    if (!selectedFollowUp) return;
    setEditLoading(true);
    try {
      const updateData: UpdateFollowUpData = { ...data };
      await updateFollowUp(selectedFollowUp.id, updateData);
      toast.success('Follow-up updated successfully');
      setShowEditModal(false);
      setSelectedFollowUp(null);
      queryClient.invalidateQueries({ queryKey: ['followUps'] });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update follow-up';
      toast.error(errorMessage);
    } finally {
      setEditLoading(false);
    }
  };

  // Modal backdrop click handler
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeModals();
    }
  };

  return (
    <div className="w-full p-4 lg:p-6">
      <FollowUpList
        onCreateNew={handleCreateNew}
        onViewFollowUp={handleViewFollowUp}
        onEditFollowUp={handleEditFollowUp}
        onDeleteFollowUp={handleDeleteFollowUp}
        onCompleteFollowUp={handleCompleteFollowUp}
        onCallCustomer={handleCallCustomer}
        showCreateButton={true}
      />

      {/* Create Modal */}
      <CreateFollowUpModal
        isOpen={showCreateModal}
        onClose={closeModals}
        onSubmit={handleCreateFollowUp}
        loading={createLoading}
      />

      {/* Edit Modal */}
      <EditFollowUpModal
        isOpen={showEditModal}
        onClose={closeModals}
        onSubmit={handleEditFollowUpSubmit}
        followUp={selectedFollowUp}
        loading={editLoading}
      />

      {/* Details Modal */}
      {showDetailsModal && selectedFollowUp && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
          onClick={handleBackdropClick}
        >
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-gray-800 dark:to-gray-800">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Calendar className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Follow-up Details
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {selectedFollowUp.title}
                  </p>
                </div>
              </div>
              <button
                onClick={closeModals}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)] modal-scrollbar">
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                    <Tag className="w-5 h-5 mr-2 text-blue-600" />
                    Basic Information
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Title:</span>
                      <p className="text-gray-900 dark:text-white font-medium">{selectedFollowUp.title}</p>
                    </div>
                    {selectedFollowUp.description && (
                      <div>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Description:</span>
                        <p className="text-gray-900 dark:text-white">{selectedFollowUp.description}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Type:</span>
                        <p className="text-gray-900 dark:text-white capitalize">{selectedFollowUp.type.replace('_', ' ')}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Priority:</span>
                        <p className="text-gray-900 dark:text-white capitalize">{selectedFollowUp.priority}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Customer Info */}
                {(selectedFollowUp.customer_name || selectedFollowUp.customer_email || selectedFollowUp.customer_phone) && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                      <User className="w-5 h-5 mr-2 text-indigo-600" />
                      Customer Information
                    </h3>
                    <div className="space-y-3">
                      {selectedFollowUp.customer_name && (
                        <div>
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Name:</span>
                          <p className="text-gray-900 dark:text-white">{selectedFollowUp.customer_name}</p>
                        </div>
                      )}
                      {selectedFollowUp.customer_email && (
                        <div>
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Email:</span>
                          <p className="text-gray-900 dark:text-white">{selectedFollowUp.customer_email}</p>
                        </div>
                      )}
                      {selectedFollowUp.customer_phone && (
                        <div>
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Phone:</span>
                          <p className="text-gray-900 dark:text-white">{selectedFollowUp.customer_phone}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Schedule Info */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                    <Calendar className="w-5 h-5 mr-2 text-green-600" />
                    Schedule Information
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Scheduled Date:</span>
                      <p className="text-gray-900 dark:text-white">
                        {new Date(selectedFollowUp.scheduled_date).toLocaleString()}
                      </p>
                    </div>
                    {selectedFollowUp.assignedUser && (
                      <div>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Assigned To:</span>
                        <p className="text-gray-900 dark:text-white">{selectedFollowUp.assignedUser.name}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => {
                      setShowDetailsModal(false);
                      handleEditFollowUp(selectedFollowUp);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                  >
                    <Edit3 className="w-4 h-4 mr-2" />
                    Edit
                  </button>
                  <button
                    onClick={closeModals}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FollowUps;
