import React from 'react';
import TodayStatistics from '@/components/Dashboard/TodayStatistics';
import CallDirectionPieChart from '@/components/Dashboard/CallDirectionPieChart';
import CallStatusPieChart from '@/components/Dashboard/CallStatusPieChart';
import IncomingCallAnalysisPieChart from '@/components/Dashboard/IncomingCallAnalysisPieChart';
import OutgoingCallAnalysisPieChart from '@/components/Dashboard/OutgoingCallAnalysisPieChart';

const Dashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Today's Statistics */}
      <TodayStatistics />
      
      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CallDirectionPieChart />
        <CallStatusPieChart />
        <IncomingCallAnalysisPieChart />
        <OutgoingCallAnalysisPieChart />
      </div>
    </div>
  );
};

export default Dashboard;