import React from 'react';

const AgentsStatus: React.FC = () => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden h-full">
      <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Agents Status</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Real-time agent performance metrics
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-6 h-full overflow-y-auto">
        <div className="grid grid-cols-1 gap-4">
          {/* Active Agents */}
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 p-4">
            <div className="flex items-center justify-between mb-3">
              <h5 className="text-sm font-bold text-emerald-800 dark:text-emerald-200">Active Agents</h5>
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">12</div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Currently online</p>
          </div>

          {/* Total Calls Today */}
          <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4">
            <div className="flex items-center justify-between mb-3">
              <h5 className="text-sm font-bold text-blue-800 dark:text-blue-200">Total Calls Today</h5>
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            </div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">247</div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">+12% from yesterday</p>
          </div>

          {/* Average Call Duration */}
          <div className="rounded-xl border border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-purple-900/20 p-4">
            <div className="flex items-center justify-between mb-3">
              <h5 className="text-sm font-bold text-purple-800 dark:text-purple-200">Avg Call Duration</h5>
              <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
            </div>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">4m 32s</div>
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">-5% from yesterday</p>
          </div>

          {/* Call Success Rate */}
          <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 p-4">
            <div className="flex items-center justify-between mb-3">
              <h5 className="text-sm font-bold text-orange-800 dark:text-orange-200">Success Rate</h5>
              <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
            </div>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">94.2%</div>
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">+2.1% from yesterday</p>
          </div>
        </div>

        {/* Top Performing Agents */}
        <div className="mt-4">
          <h5 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Top Performing Agents</h5>
          <div className="space-y-2">
            {[
              { name: 'Agent 101', calls: 28, duration: '5m 12s', success: '96.4%' },
              { name: 'Agent 102', calls: 25, duration: '4m 48s', success: '95.2%' },
              { name: 'Agent 103', calls: 23, duration: '4m 15s', success: '93.8%' }
            ].map((agent, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                    index === 0 ? 'bg-yellow-500' : 
                    index === 1 ? 'bg-gray-400' : 
                    'bg-orange-500'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{agent.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{agent.calls} calls</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium text-gray-900 dark:text-white">{agent.duration}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{agent.success}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentsStatus;
