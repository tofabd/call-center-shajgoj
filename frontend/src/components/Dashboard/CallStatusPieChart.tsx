import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

type EChartsOption = echarts.EChartsOption;

interface CallStatusPieChartProps {
  answeredCount: number;
  missedCount: number;
  busyCount: number;
  failedCount: number;
  className?: string;
  title?: string;
  height?: number;
}

const CallStatusPieChart: React.FC<CallStatusPieChartProps> = ({
  answeredCount,
  missedCount,
  busyCount,
  failedCount,
  className = '',
  title = 'Call Status Distribution',
  height = 300
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // Initialize chart if not already done
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, null, {
        renderer: 'svg', // Use SVG for crisp rendering
        devicePixelRatio: window.devicePixelRatio || 1, // Handle high DPI displays
        width: 'auto',
        height: 'auto'
      });
    }

    const totalCalls = answeredCount + missedCount + busyCount + failedCount;
    
    // Prepare data for pie chart with enhanced styling
    const pieData = [];
    
    if (answeredCount > 0) {
      pieData.push({
        value: answeredCount,
        name: 'Answered',
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [{
              offset: 0, color: '#34d399'
            }, {
              offset: 1, color: '#059669'
            }],
            global: false
          },
          borderColor: '#ffffff',
          borderWidth: 3,
          shadowBlur: 10,
          shadowColor: 'rgba(16, 185, 129, 0.3)',
          shadowOffsetY: 2
        }
      });
    }
    
    if (missedCount > 0) {
      pieData.push({
        value: missedCount,
        name: 'Missed',
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [{
              offset: 0, color: '#f87171'
            }, {
              offset: 1, color: '#dc2626'
            }],
            global: false
          },
          borderColor: '#ffffff',
          borderWidth: 3,
          shadowBlur: 10,
          shadowColor: 'rgba(239, 68, 68, 0.3)',
          shadowOffsetY: 2
        }
      });
    }
    
    if (busyCount > 0) {
      pieData.push({
        value: busyCount,
        name: 'Busy',
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [{
              offset: 0, color: '#fbbf24'
            }, {
              offset: 1, color: '#d97706'
            }],
            global: false
          },
          borderColor: '#ffffff',
          borderWidth: 3,
          shadowBlur: 10,
          shadowColor: 'rgba(245, 158, 11, 0.3)',
          shadowOffsetY: 2
        }
      });
    }
    
    if (failedCount > 0) {
      pieData.push({
        value: failedCount,
        name: 'Failed',
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [{
              offset: 0, color: '#9ca3af'
            }, {
              offset: 1, color: '#4b5563'
            }],
            global: false
          },
          borderColor: '#ffffff',
          borderWidth: 3,
          shadowBlur: 10,
          shadowColor: 'rgba(107, 114, 128, 0.3)',
          shadowOffsetY: 2
        }
      });
    }

    const option: EChartsOption = {
      title: {
        text: title,
        left: 'center',
        top: 15,
        textStyle: {
          fontSize: 18,
          fontWeight: 'bold',
          color: '#1f2937',
          fontFamily: 'Inter, system-ui, sans-serif'
        }
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        borderRadius: 8,
        padding: [12, 16],
        textStyle: {
          color: '#1f2937',
          fontSize: 14,
          fontWeight: '500'
        },
        shadowBlur: 20,
        shadowColor: 'rgba(0, 0, 0, 0.1)',
        formatter: function(params: any) {
          const percentage = totalCalls > 0 ? ((params.value / totalCalls) * 100).toFixed(1) : '0.0';
          return `
            <div style="line-height: 1.6;">
              <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <div style="width: 12px; height: 12px; background: ${params.color}; border-radius: 50%; margin-right: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"></div>
                <strong style="font-size: 15px;">${params.name}</strong>
              </div>
              <div style="font-size: 13px; color: #6b7280; margin-bottom: 4px;">Count: <strong style="color: #1f2937;">${params.value.toLocaleString()}</strong></div>
              <div style="font-size: 13px; color: #6b7280;">Percentage: <strong style="color: #1f2937;">${percentage}%</strong></div>
            </div>
          `;
        }
      },
      legend: {
        orient: 'horizontal',
        bottom: 15,
        left: 'center',
        textStyle: {
          color: '#4b5563',
          fontSize: 13,
          fontWeight: '500',
          fontFamily: 'Inter, system-ui, sans-serif'
        },
        itemWidth: 16,
        itemHeight: 16,
        itemGap: 25,
        icon: 'circle'
      },
      series: [
        {
          name: 'Call Status',
          type: 'pie',
          radius: ['35%', '75%'], // Larger donut for more impact
          center: ['50%', '52%'],
          avoidLabelOverlap: false,
          roseType: false,
          emphasis: {
            itemStyle: {
              shadowBlur: 20,
              shadowOffsetX: 0,
              shadowOffsetY: 5,
              shadowColor: 'rgba(0, 0, 0, 0.3)',
              scale: 1.08,
              borderWidth: 4,
              borderColor: '#ffffff'
            },
            label: {
              show: true,
              fontSize: 16,
              fontWeight: 'bold'
            }
          },
          labelLine: {
            show: true,
            length: 15,
            length2: 25,
            lineStyle: {
              color: '#d1d5db',
              width: 2,
              type: 'solid'
            },
            smooth: 0.3
          },
          label: {
            show: true,
            position: 'outside',
            fontSize: 14,
            fontWeight: '600',
            color: '#374151',
            fontFamily: 'Inter, system-ui, sans-serif',
            formatter: function(params: any) {
              const percentage = totalCalls > 0 ? ((params.value / totalCalls) * 100).toFixed(1) : '0.0';
              return `{name|${params.name}}\n{value|${params.value.toLocaleString()}} ({percent|${percentage}%})`;
            },
            rich: {
              name: {
                fontSize: 14,
                fontWeight: 'bold',
                color: '#1f2937',
                lineHeight: 20
              },
              value: {
                fontSize: 13,
                color: '#6b7280',
                lineHeight: 18
              },
              percent: {
                fontSize: 13,
                color: '#6b7280',
                fontWeight: '500'
              }
            }
          },
          data: pieData,
          animationType: 'scale',
          animationEasing: 'cubicOut',
          animationDuration: 800,
          animationDelay: function (idx: number) {
            return idx * 100;
          }
        }
      ]
    };

    // Set option and handle responsive
    option && chartInstance.current.setOption(option, true);

    // Handle dark mode
    const handleThemeChange = () => {
      if (chartInstance.current) {
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#f3f4f6' : '#374151';
        const secondaryTextColor = isDark ? '#9ca3af' : '#6b7280';
        
        chartInstance.current.setOption({
          title: {
            textStyle: {
              color: textColor
            }
          },
          legend: {
            textStyle: {
              color: secondaryTextColor
            }
          },
          series: [{
            label: {
              color: textColor
            }
          }]
        }, false);
      }
    };

    // Handle resize
    const handleResize = () => {
      if (chartInstance.current) {
        chartInstance.current.resize({
          width: 'auto',
          height: 'auto'
        });
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
  }, [answeredCount, missedCount, busyCount, failedCount, title, height]);

  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []);

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 ${className}`}>
      <div 
        ref={chartRef} 
        style={{ 
          height: `${height}px`, 
          width: '100%',
          imageRendering: 'crisp-edges',
          imageRendering: '-webkit-optimize-contrast'
        }}
        className="p-2"
      />
      
      {/* Summary stats below chart */}
      <div className="px-6 pb-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-1">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Answered</span>
          </div>
          <div className="text-xl font-bold text-green-600 dark:text-green-400">
            {answeredCount.toLocaleString()}
          </div>
        </div>
        
        <div className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-1">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Missed</span>
          </div>
          <div className="text-xl font-bold text-red-600 dark:text-red-400">
            {missedCount.toLocaleString()}
          </div>
        </div>
        
        <div className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-1">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Busy</span>
          </div>
          <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
            {busyCount.toLocaleString()}
          </div>
        </div>
        
        <div className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-1">
            <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Failed</span>
          </div>
          <div className="text-xl font-bold text-gray-600 dark:text-gray-400">
            {failedCount.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallStatusPieChart;