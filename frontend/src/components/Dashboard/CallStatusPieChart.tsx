import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { callLogService } from '../../services/callLogService';

type EChartsOption = echarts.EChartsOption;

interface CallStatusPieChartProps {
  className?: string;
  title?: string;
  height?: number;
}

const CallStatusPieChart: React.FC<CallStatusPieChartProps> = ({
  className = '',
  title = 'Call Status Distribution',
  height = 300
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [statusCounts, setStatusCounts] = useState({
    completed: 0,
    no_answer: 0,
    busy: 0,
    failed: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch call statistics
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const stats = await callLogService.getTodayStats();
        setStatusCounts({
          completed: stats.calls_by_status?.completed || 0,
          no_answer: stats.calls_by_status?.no_answer || 0,
          busy: stats.calls_by_status?.busy || 0,
          failed: stats.calls_by_status?.failed || 0
        });
        setError(null);
      } catch (err) {
        console.error('Error fetching call status stats:', err);
        setError('Failed to load call statistics');
        setStatusCounts({ completed: 0, no_answer: 0, busy: 0, failed: 0 });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  useEffect(() => {
    if (!chartRef.current || loading) return;

    // Initialize chart if not already done
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, null, {
        renderer: 'svg'
      });
    }

    const totalCalls = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);

    const option: EChartsOption = {
      backgroundColor: 'transparent',
      title: {
        text: title,
        left: 'center',
        top: 20,
        textStyle: {
          fontSize: 16,
          fontWeight: '600',
          color: document.documentElement.classList.contains('dark') ? '#f9fafb' : '#111827'
        }
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: '#374151',
        borderColor: '#4b5563',
        borderWidth: 1,
        borderRadius: 8,
        padding: [8, 12],
        textStyle: {
          color: '#f9fafb',
          fontSize: 12,
          fontWeight: '500'
        },
        shadowBlur: 10,
        shadowColor: 'rgba(0, 0, 0, 0.3)',
        formatter: (params: any) => {
          const percentage = totalCalls > 0 ? ((params.value / totalCalls) * 100).toFixed(1) : '0';
          return `
            <div style="font-weight: 600; margin-bottom: 4px;">${params.name}</div>
            <div>Calls: ${params.value.toLocaleString()}</div>
            <div>Percentage: ${percentage}%</div>
          `;
        }
      },
      legend: {
        orient: 'horizontal',
        bottom: 20,
        left: 'center',
        textStyle: {
          color: document.documentElement.classList.contains('dark') ? '#d1d5db' : '#374151',
          fontSize: 12,
          fontWeight: '500',
          fontFamily: 'Inter, system-ui, sans-serif'
        },
        itemWidth: 14,
        itemHeight: 14,
        itemGap: 16,
        icon: 'circle'
      },
      series: [{
        name: title,
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '55%'],
        avoidLabelOverlap: false,
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
            scale: 1.05,
            borderWidth: 2,
            borderColor: '#ffffff'
          },
          label: {
            show: true,
            fontSize: '14',
            fontWeight: 'bold'
          }
        },
        labelLine: {
          show: false
        },
        label: {
          show: false,
          position: 'center'
        },
        data: [
          {
            value: statusCounts.completed,
            name: 'Completed',
            itemStyle: {
              color: '#10b981',
              borderRadius: 10,
              shadowColor: 'rgba(16, 185, 129, 0.5)',
              shadowBlur: 10
            }
          },
          {
            value: statusCounts.no_answer,
            name: 'No Answer',
            itemStyle: {
              color: '#f59e0b',
              borderRadius: 10,
              shadowColor: 'rgba(245, 158, 11, 0.5)',
              shadowBlur: 10
            }
          },
          {
            value: statusCounts.busy,
            name: 'Busy',
            itemStyle: {
              color: '#ef4444',
              borderRadius: 10,
              shadowColor: 'rgba(239, 68, 68, 0.5)',
              shadowBlur: 10
            }
          },
          {
            value: statusCounts.failed,
            name: 'Failed',
            itemStyle: {
              color: '#6b7280',
              borderRadius: 10,
              shadowColor: 'rgba(107, 114, 128, 0.5)',
              shadowBlur: 10
            }
          }
        ]
      }]
    };

    chartInstance.current.setOption(option);

    // Handle theme changes
    const handleThemeChange = () => {
      if (chartInstance.current) {
        const isDark = document.documentElement.classList.contains('dark');
        chartInstance.current.setOption({
          title: {
            textStyle: {
              color: isDark ? '#f9fafb' : '#111827'
            }
          },
          legend: {
            textStyle: {
              color: isDark ? '#d1d5db' : '#374151'
            }
          }
        });
      }
    };

    // Handle resize
    const handleResize = () => {
      if (chartInstance.current) {
        chartInstance.current.resize();
      }
    };

    // Set up observers
    const observer = new MutationObserver(handleThemeChange);
    observer.observe(document.documentElement, { 
      attributes: true, 
      attributeFilter: ['class'] 
    });

    window.addEventListener('resize', handleResize);
    
    // Initial theme setup
    handleThemeChange();

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [statusCounts, title, height, loading]);

  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []);

  if (error) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 ${className}`}>
        <div className="p-6 text-center">
          <div className="text-red-600 dark:text-red-400">
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 ${className}`}>
      {loading ? (
        <div className="p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading...</div>
        </div>
      ) : (
        <div 
          ref={chartRef} 
          style={{ 
            height: `${height}px`, 
            width: '100%',
          }}
          className="p-2"
        />
      )}
    </div>
  );
};

export default CallStatusPieChart;