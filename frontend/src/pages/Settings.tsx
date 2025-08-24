import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  Users, 
  Server,
  Bell
} from 'lucide-react';
import ExtensionManagement from '../components/Settings/ExtensionManagement';

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('extensions');

  const tabs = [
    {
      id: 'extensions',
      name: 'Extension Management',
      icon: Users,
      component: ExtensionManagement
    },
    {
      id: 'system',
      name: 'System Settings',
      icon: Server,
      component: () => <div className="p-6 text-center text-gray-500">System settings coming soon...</div>
    },
    {
      id: 'notifications',
      name: 'Notifications',
      icon: Bell,
      component: () => <div className="p-6 text-center text-gray-500">Notification settings coming soon...</div>
    }
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || ExtensionManagement;

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-[calc(100vh-4rem)]">
      <div className="max-w-7xl mx-auto p-6">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <SettingsIcon className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your call center configuration and preferences
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Tabs Navigation */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center space-x-3 px-6 py-4 text-sm font-medium transition-colors duration-200
                      ${activeTab === tab.id
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }
                    `}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{tab.name}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="min-h-[600px]">
            <ActiveComponent />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;