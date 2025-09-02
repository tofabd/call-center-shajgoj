import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  Users, 
  Server
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
      id: 'team',
      name: 'Team Settings',
      icon: Server,
      component: () => <div className="p-6 text-center text-gray-500">Team settings coming soon...</div>
    }
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || ExtensionManagement;

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-[calc(100vh-4rem)]">
      <div className="w-full p-4 lg:p-6 space-y-6">
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
                      flex items-center space-x-3 px-4 sm:px-6 py-4 text-sm font-medium transition-colors duration-200
                      ${activeTab === tab.id
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }
                    `}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="hidden sm:inline">{tab.name}</span>
                    <span className="sm:hidden">{tab.name.split(' ')[0]}</span>
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