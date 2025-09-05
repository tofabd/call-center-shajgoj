import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { callLogService } from '../../services/callLogService';

type EChartsOption = echarts.EChartsOption;

interface CallDirectionPieChartProps {
  className?: string;
  title?: string;
  height?: number;
}

const CallDirectionPieChart: React.FC<CallDirectionPieChartProps> = ({
  className = '',
  title = 'Call Direction Distribution',
  height = 300
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [incomingCount, setIncomingCount] = useState(0);
  const [outgoingCount, setOutgoingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch call statistics
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const stats = await callLogService.getTodayStats();
        setIncomingCount(stats.incoming_calls || 0);
        setOutgoingCount(stats.outgoing_calls || 0);
        setError(null);
      } catch (err) {
        console.error('Error fetching call direction stats:', err);
        setError('Failed to load call statistics');
        setIncomingCount(0);
        setOutgoingCount(0);
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

    const totalCalls = incomingCount + outgoingCount;

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
        itemGap: 20,
        icon: 'circle'
      },
      series: [{
        name: title,
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '55%'],
        avoidLabelOverlap: false,
        roseType: false,
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
            value: incomingCount,
            name: 'Incoming',
            itemStyle: {
              color: '#10b981',
              borderRadius: 10,
              shadowColor: 'rgba(16, 185, 129, 0.5)',
              shadowBlur: 10
            }
          },
          {
            value: outgoingCount,
            name: 'Outgoing',
            itemStyle: {
              color: '#3b82f6',
              borderRadius: 10,
              shadowColor: 'rgba(59, 130, 246, 0.5)',
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
  }, [incomingCount, outgoingCount, title, height, loading]);

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
        <>
          <div 
            ref={chartRef} 
            style={{ 
              height: `${height}px`, 
              width: '100%',
            }}
            className="p-2"
          />
          
          {/* Summary stats below chart */}
          <div className="px-6 pb-6 grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center space-x-2 mb-1">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Incoming</span>
              </div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {incomingCount.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-500">
                {incomingCount + outgoingCount > 0 ? 
                  `${((incomingCount / (incomingCount + outgoingCount)) * 100).toFixed(1)}%` : 
                  '0%'
                }
              </div>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center space-x-2 mb-1">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Outgoing</span>
              </div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {outgoingCount.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-500">
                {incomingCount + outgoingCount > 0 ? 
                  `${((outgoingCount / (incomingCount + outgoingCount)) * 100).toFixed(1)}%` : 
                  '0%'
                }
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CallDirectionPieChart;