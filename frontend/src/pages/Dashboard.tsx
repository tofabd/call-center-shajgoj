import React from 'react';
import { 
  Users, 
  Phone, 
  ShoppingCart, 
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

const Dashboard: React.FC = () => {
  const stats = [
    {
      title: 'Total Customers',
      value: '2,543',
      change: '+12.5%',
      changeType: 'positive',
      icon: Users,
      color: 'blue'
    },
    {
      title: 'Active Calls',
      value: '147',
      change: '+8.2%',
      changeType: 'positive',
      icon: Phone,
      color: 'green'
    },
    {
      title: 'Orders Today',
      value: '89',
      change: '-3.1%',
      changeType: 'negative',
      icon: ShoppingCart,
      color: 'purple'
    },
    {
      title: 'Revenue',
      value: '$12,543',
      change: '+15.7%',
      changeType: 'positive',
      icon: TrendingUp,
      color: 'yellow'
    }
  ];

  const getColorClasses = (color: string) => {
    const colors = {
      blue: 'bg-blue-500 text-blue-500 bg-blue-100 dark:bg-blue-900',
      green: 'bg-green-500 text-green-500 bg-green-100 dark:bg-green-900',
      purple: 'bg-purple-500 text-purple-500 bg-purple-100 dark:bg-purple-900',
      yellow: 'bg-yellow-500 text-yellow-500 bg-yellow-100 dark:bg-yellow-900'
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  return (
    <div className="w-full p-4 lg:p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Welcome back! Here's what's happening with your CRM today.
        </p>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          const colorClasses = getColorClasses(stat.color).split(' ');
          
          return (
            <div
              key={index}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow duration-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {stat.title}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stat.value}
                  </p>
                  <div className="flex items-center mt-2">
                    {stat.changeType === 'positive' ? (
                      <ArrowUpRight className="h-4 w-4 text-green-500 mr-1" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 text-red-500 mr-1" />
                    )}
                    <span className={`text-sm font-medium ${
                      stat.changeType === 'positive' ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {stat.change}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">
                      vs last month
                    </span>
                  </div>
                </div>
                <div className={`p-3 rounded-full ${colorClasses[2]} ${colorClasses[3]}`}>
                  <Icon className={`h-6 w-6 ${colorClasses[1]}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Content Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Recent Activity</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  New customer registered: John Smith
                </p>
                <span className="text-xs text-gray-500">2 min ago</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Order #1234 completed successfully
                </p>
                <span className="text-xs text-gray-500">5 min ago</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Call with client scheduled for 3 PM
                </p>
                <span className="text-xs text-gray-500">10 min ago</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Quick Actions</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4">
              <button className="flex flex-col items-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                <Users className="h-8 w-8 text-gray-400 mb-2" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Add Customer</span>
              </button>
              <button className="flex flex-col items-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-green-500 dark:hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors">
                <Phone className="h-8 w-8 text-gray-400 mb-2" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Start Call</span>
              </button>
              <button className="flex flex-col items-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-purple-500 dark:hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors">
                <ShoppingCart className="h-8 w-8 text-gray-400 mb-2" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">New Order</span>
              </button>
              <button className="flex flex-col items-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-yellow-500 dark:hover:border-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors">
                <TrendingUp className="h-8 w-8 text-gray-400 mb-2" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">View Reports</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 