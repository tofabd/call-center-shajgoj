import React, { useState, useEffect } from 'react';
import { X, Calendar, Check } from 'lucide-react';

interface DateRangePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (range: { start: Date; end: Date }) => void;
  initialRange?: { start: Date; end: Date };
  title?: string;
}

const DateRangePickerModal: React.FC<DateRangePickerModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialRange,
  title = 'Select Custom Date Range'
}) => {
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Initialize dates when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialRange) {
        setStartDate(initialRange.start.toISOString().split('T')[0]);
        setEndDate(initialRange.end.toISOString().split('T')[0]);
      } else {
        // Default to last 7 days
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 7);
        setStartDate(start.toISOString().split('T')[0]);
        setEndDate(end.toISOString().split('T')[0]);
      }
      setError('');
    }
  }, [isOpen, initialRange]);

  // Validate date range
  const validateDates = (start: string, end: string): string => {
    if (!start || !end) {
      return 'Please select both start and end dates';
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today

    if (startDate > endDate) {
      return 'Start date must be before end date';
    }

    if (startDate > today) {
      return 'Start date cannot be in the future';
    }

    if (endDate > today) {
      return 'End date cannot be in the future';
    }

    // Check if range is too long (optional - you can adjust or remove this)
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 365) {
      return 'Date range cannot exceed 365 days';
    }

    return '';
  };

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    const validationError = validateDates(value, endDate);
    setError(validationError);
  };

  const handleEndDateChange = (value: string) => {
    setEndDate(value);
    const validationError = validateDates(startDate, value);
    setError(validationError);
  };

  const handleConfirm = () => {
    const validationError = validateDates(startDate, endDate);
    if (validationError) {
      setError(validationError);
      return;
    }

    const range = {
      start: new Date(startDate),
      end: new Date(endDate)
    };

    onConfirm(range);
    onClose();
  };

  const handleCancel = () => {
    setError('');
    onClose();
  };

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleCancel();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden'; // Prevent background scroll
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300"
        onClick={handleCancel}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 transform transition-all duration-300 scale-100">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-linear-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <Calendar className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {title}
                </h3>
              </div>
              <button
                onClick={handleCancel}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            <div className="space-y-4">
              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg 
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                           focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:focus:ring-orange-400 
                           transition-colors"
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className="w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg 
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                           focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:focus:ring-orange-400 
                           transition-colors"
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              {/* Quick Selection Buttons */}
              <div className="pt-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Quick Selection:</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Last 7 days', days: 7 },
                    { label: 'Last 30 days', days: 30 },
                    { label: 'Last 90 days', days: 90 }
                  ].map((preset) => (
                    <button
                      key={preset.days}
                      onClick={() => {
                        const end = new Date();
                        const start = new Date();
                        start.setDate(end.getDate() - preset.days);
                        setStartDate(start.toISOString().split('T')[0]);
                        setEndDate(end.toISOString().split('T')[0]);
                        setError('');
                      }}
                      className="px-3 py-2 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 
                               hover:bg-orange-100 dark:hover:bg-orange-900/30 hover:text-orange-700 dark:hover:text-orange-300
                               rounded-lg transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 
                         hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 
                         rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={!!error}
                className="px-6 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 
                         disabled:bg-gray-400 disabled:cursor-not-allowed
                         rounded-lg transition-colors flex items-center space-x-2"
              >
                <Check className="h-4 w-4" />
                <span>Apply Range</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DateRangePickerModal;