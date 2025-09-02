import React, { useState } from 'react';
import { Calendar, Clock, BarChart3, TrendingUp } from 'lucide-react';
import DateRangePickerModal from './DateRangePickerModal';
import type { TimeRange } from '@services/callLogService';

interface TimeRangeSelectorProps {
  activeRange: TimeRange;
  onRangeChange: (range: TimeRange) => void;
  customRange?: { start: Date; end: Date };
  onCustomRangeChange?: (range: { start: Date; end: Date }) => void;
  disabled?: boolean;
}

const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  activeRange,
  onRangeChange,
  customRange,
  onCustomRangeChange,
  disabled = false
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const timeRangeOptions = [
    {
      value: 'today' as TimeRange,
      label: 'Today',
      icon: Clock,
      color: 'blue',
      description: 'Last 24 hours'
    },
    {
      value: 'weekly' as TimeRange,
      label: 'This Week',
      icon: BarChart3,
      color: 'green',
      description: 'Monday to Sunday'
    },
    {
      value: 'monthly' as TimeRange,
      label: 'This Month',
      icon: TrendingUp,
      color: 'purple',
      description: 'Month to date'
    },
    {
      value: 'custom' as TimeRange,
      label: 'Custom Range',
      icon: Calendar,
      color: 'orange',
      description: 'Select dates'
    }
  ];

  const getColorClasses = (color: string, isActive: boolean) => {
    const colorMap = {
      blue: {
        bg: isActive 
          ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white' 
          : 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/40 dark:to-blue-800/40',
        border: 'ring-1 ring-blue-300 dark:ring-blue-600',
        text: isActive ? 'text-white' : 'text-blue-700 dark:text-blue-300',
        icon: isActive ? 'text-white' : 'text-blue-600 dark:text-blue-400',
        shadow: isActive ? 'shadow-blue-200 dark:shadow-blue-900/50' : 'shadow-blue-100 dark:shadow-blue-900/30'
      },
      green: {
        bg: isActive 
          ? 'bg-gradient-to-br from-green-600 to-green-700 text-white' 
          : 'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/40 dark:to-green-800/40',
        border: 'ring-1 ring-green-300 dark:ring-green-600',
        text: isActive ? 'text-white' : 'text-green-700 dark:text-green-300',
        icon: isActive ? 'text-white' : 'text-green-600 dark:text-green-400',
        shadow: isActive ? 'shadow-green-200 dark:shadow-green-900/50' : 'shadow-green-100 dark:shadow-green-900/30'
      },
      purple: {
        bg: isActive 
          ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white' 
          : 'bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/40 dark:to-purple-800/40',
        border: 'ring-1 ring-purple-300 dark:ring-purple-600',
        text: isActive ? 'text-white' : 'text-purple-700 dark:text-purple-300',
        icon: isActive ? 'text-white' : 'text-purple-600 dark:text-purple-400',
        shadow: isActive ? 'shadow-purple-200 dark:shadow-purple-900/50' : 'shadow-purple-100 dark:shadow-purple-900/30'
      },
      orange: {
        bg: isActive 
          ? 'bg-gradient-to-br from-orange-600 to-orange-700 text-white' 
          : 'bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/40 dark:to-orange-800/40',
        border: 'ring-1 ring-orange-300 dark:ring-orange-600',
        text: isActive ? 'text-white' : 'text-orange-700 dark:text-orange-300',
        icon: isActive ? 'text-white' : 'text-orange-600 dark:text-orange-400',
        shadow: isActive ? 'shadow-orange-200 dark:shadow-orange-900/50' : 'shadow-orange-100 dark:shadow-orange-900/30'
      }
    };
    return colorMap[color as keyof typeof colorMap];
  };

  const handleRangeClick = (range: TimeRange) => {
    if (range === 'custom') {
      setIsModalOpen(true);
    } else {
      onRangeChange(range);
    }
  };

  const handleCustomRangeConfirm = (range: { start: Date; end: Date }) => {
    if (onCustomRangeChange) {
      onCustomRangeChange(range);
    }
    onRangeChange('custom');
  };

  return (
    <div className="space-y-6">
      {/* Time Range Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {timeRangeOptions.map((option) => {
          const isActive = activeRange === option.value;
          const colors = getColorClasses(option.color, isActive);
          const Icon = option.icon;

          return (
            <button
              key={option.value}
              onClick={() => handleRangeClick(option.value)}
              disabled={disabled}
              className={`
                p-6 rounded-xl transition-all duration-300 transform
                hover:shadow-lg hover:scale-105 hover:-translate-y-1
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0
                ${colors.bg} ${colors.border} shadow-lg ${colors.shadow}
              `}
            >
              <div className="flex flex-col items-center text-center space-y-2">
                <Icon className={`h-6 w-6 ${colors.icon}`} />
                <div>
                  <div className={`text-base font-semibold ${colors.text}`}>
                    {option.label}
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {option.value === 'custom' 
                      ? (customRange && activeRange === 'custom'
                          ? `${customRange.start.toLocaleDateString()} - ${customRange.end.toLocaleDateString()}`
                          : 'Click to select dates'
                        )
                      : option.description
                    }
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Date Range Picker Modal */}
      <DateRangePickerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleCustomRangeConfirm}
        initialRange={customRange}
      />
    </div>
  );
};

export default TimeRangeSelector;