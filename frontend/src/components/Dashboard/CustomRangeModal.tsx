import React, { useState } from 'react';
import { Calendar, CalendarRange, X } from 'lucide-react';

interface DateRange {
  startDate: string;
  endDate: string;
  label: string;
}

interface CustomRangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDateRangeSelected: (dateRange: DateRange) => void;
}

const CustomRangeModal: React.FC<CustomRangeModalProps> = ({ 
  isOpen, 
  onClose, 
  onDateRangeSelected 
}) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Quick date range options
  const quickRanges = [
    {
      label: 'Last 7 Days',
      getValue: () => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 7);
        return {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0]
        };
      }
    },
    {
      label: 'Last 30 Days',
      getValue: () => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 30);
        return {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0]
        };
      }
    },
    {
      label: 'Last 3 Months',
      getValue: () => {
        const end = new Date();
        const start = new Date();
        start.setMonth(start.getMonth() - 3);
        return {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0]
        };
      }
    },
    {
      label: 'This Year',
      getValue: () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 1);
        const end = new Date();
        return {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0]
        };
      }
    }
  ];

  const handleQuickRange = (range: any) => {
    const { start, end } = range.getValue();
    setStartDate(start);
    setEndDate(end);
  };

  const handleApplyRange = () => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      const label = `${start.toLocaleDateString()} - ${end.toLocaleDateString()} (${diffDays} days)`;
      
      onDateRangeSelected({
        startDate,
        endDate,
        label
      });
      
      onClose();
    }
  };

  const isValidRange = startDate && endDate && startDate <= endDate;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-sky-50 to-cyan-50 dark:from-gray-800 dark:to-gray-700 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-sky-600 rounded-lg">
              <CalendarRange className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Select Date Range</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Choose a custom date range for your analytics
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/80 dark:bg-gray-700/80 hover:bg-white dark:hover:bg-gray-700 hover:shadow-md transition-all duration-200"
          >
            <X className="h-4 w-4 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Date Range Selector */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:bg-gray-700 dark:text-white"
                  min={startDate}
                />
              </div>
            </div>

            {/* Quick Range Buttons */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Quick Ranges
              </label>
              <div className="grid grid-cols-2 gap-2">
                {quickRanges.map((range, index) => (
                  <button
                    key={index}
                    onClick={() => handleQuickRange(range)}
                    className="px-4 py-3 text-sm bg-gradient-to-r from-sky-100 to-cyan-100 dark:from-sky-900/30 dark:to-cyan-900/30 text-sky-700 dark:text-sky-300 rounded-lg hover:from-sky-200 hover:to-cyan-200 dark:hover:from-sky-900/50 dark:hover:to-cyan-900/50 transition-all duration-200 border border-sky-200 dark:border-sky-800 font-medium"
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            {isValidRange && (
              <div className="bg-gradient-to-r from-sky-50 to-cyan-50 dark:from-sky-900/20 dark:to-cyan-900/20 rounded-xl border border-sky-200 dark:border-sky-800 p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Calendar className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                  <h4 className="text-sm font-semibold text-sky-900 dark:text-sky-300">
                    Selected Range Preview
                  </h4>
                </div>
                <p className="text-sm text-sky-700 dark:text-sky-400">
                  From: <span className="font-medium">{new Date(startDate).toLocaleDateString()}</span>
                </p>
                <p className="text-sm text-sky-700 dark:text-sky-400">
                  To: <span className="font-medium">{new Date(endDate).toLocaleDateString()}</span>
                </p>
                <p className="text-sm text-sky-700 dark:text-sky-400">
                  Duration: <span className="font-medium">
                    {Math.ceil(Math.abs(new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} days
                  </span>
                </p>
              </div>
            )}

            {/* Validation Error */}
            {startDate && endDate && startDate > endDate && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm text-red-600 dark:text-red-400">
                  End date must be after start date
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleApplyRange}
            disabled={!isValidRange}
            className={`px-6 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
              isValidRange
                ? 'bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white shadow-lg transform hover:scale-105'
                : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            }`}
          >
            Apply Range
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomRangeModal;