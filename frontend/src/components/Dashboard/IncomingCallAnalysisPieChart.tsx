import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

type EChartsOption = echarts.EChartsOption;

interface IncomingCallAnalysisPieChartProps {
  answeredCount: number;
  missedCount: number;
  busyCount: number;
  failedCount: number;
  noAnswerCount?: number;
  rejectedCount?: number;
  canceledCount?: number;
  className?: string;
  title?: string;
  height?: number;
}

const IncomingCallAnalysisPieChart: React.FC<IncomingCallAnalysisPieChartProps> = ({
  answeredCount,
  missedCount,
  busyCount,
  failedCount,
  noAnswerCount = 0,
  rejectedCount = 0,
  canceledCount = 0,
  className = '',
  title = 'Incoming Call Status Analysis',
  height = 400
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // Initialize chart if not already done
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, null, {
        renderer: 'canvas',
        useDirtyRect: false
      });
    }

    const totalCalls = answeredCount + missedCount + busyCount + failedCount + noAnswerCount + rejectedCount + canceledCount;
    
    // Prepare data exactly like ECharts example with numerical values in names
    const pieData = [];
    
    // Include ALL status types with values > 0 and show counts in legend names
    if (answeredCount > 0) {
      pieData.push({ value: answeredCount, name: `Answered (${answeredCount.toLocaleString()})` });
    }
    if (missedCount > 0) {
      pieData.push({ value: missedCount, name: `Missed (${missedCount.toLocaleString()})` });
    }
    if (busyCount > 0) {
      pieData.push({ value: busyCount, name: `Busy (${busyCount.toLocaleString()})` });
    }
    if (failedCount > 0) {
      pieData.push({ value: failedCount, name: `Failed (${failedCount.toLocaleString()})` });
    }
    if (noAnswerCount > 0) {
      pieData.push({ value: noAnswerCount, name: `No Answer (${noAnswerCount.toLocaleString()})` });
    }
    if (canceledCount > 0) {
      pieData.push({ value: canceledCount, name: `Canceled (${canceledCount.toLocaleString()})` });
    }
    if (rejectedCount > 0) {
      pieData.push({ value: rejectedCount, name: `Rejected (${rejectedCount.toLocaleString()})` });
    }

    const option: EChartsOption = {
      title: {
        text: title,
        subtext: `${totalCalls.toLocaleString()} Total Calls`,
        left: 'center'
      },
      tooltip: {
        trigger: 'item'
      },
      legend: {
        orient: 'vertical',
        left: 'left'
      },
      series: [
        {
          name: 'Call Status',
          type: 'pie',
          radius: '50%',
          data: pieData,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }
      ]
    };

    // Set option exactly like ECharts example
    if (option && typeof option === 'object') {
      chartInstance.current.setOption(option);
    }

    // Handle resize exactly like ECharts example
    const handleResize = () => {
      if (chartInstance.current) {
        chartInstance.current.resize();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [answeredCount, missedCount, busyCount, failedCount, noAnswerCount, canceledCount, rejectedCount, title, height]);

  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []);

  return (
    <div className={`bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-700 ${className}`}>
      <div 
        ref={chartRef} 
        style={{ height: `${height}px`, width: '100%' }}
      />
    </div>
  );
};

export default IncomingCallAnalysisPieChart;