import React from 'react';
import { X, Edit3 } from 'lucide-react';
import type { CustomerFollowUp, CreateFollowUpData } from '../../types/followUp';
import FollowUpForm from './FollowUpForm';

interface EditFollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateFollowUpData) => Promise<void>;
  followUp: CustomerFollowUp | null;
  loading?: boolean;
}

const EditFollowUpModal: React.FC<EditFollowUpModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  followUp,
  loading = false,
}) => {
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen || !followUp) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-gray-800 dark:to-gray-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Edit3 className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Edit Follow-up
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Update follow-up: {followUp.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)] modal-scrollbar">
          <FollowUpForm
            initialValues={followUp}
            onSubmit={onSubmit}
            onCancel={onClose}
            loading={loading}
            isEdit={true}
          />
        </div>
      </div>
    </div>
  );
};

export default EditFollowUpModal; 