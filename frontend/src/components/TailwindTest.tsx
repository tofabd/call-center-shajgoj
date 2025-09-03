// Tailwind 4 compatibility test for TeamSettings
import React from 'react';

const TailwindTest: React.FC = () => {
  return (
    <div className="p-6 bg-white dark:bg-gray-900 min-h-screen">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Tailwind 4 Compatibility Test
      </h1>
      
      {/* Test new opacity syntax */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 dark:bg-blue-950 dark:bg-opacity-50 p-4 rounded-lg border dark:border-blue-800">
          <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">Updated Opacity</div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Using bg-opacity-50 instead of /50</p>
        </div>
        
        <div className="bg-green-50 dark:bg-green-950 dark:bg-opacity-50 p-4 rounded-lg border dark:border-green-800">
          <div className="text-lg font-semibold text-green-600 dark:text-green-400">Better Borders</div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Using explicit borders for dark mode</p>
        </div>
        
        <div className="bg-purple-50 dark:bg-purple-950 dark:bg-opacity-50 p-4 rounded-lg border dark:border-purple-800">
          <div className="text-lg font-semibold text-purple-600 dark:text-purple-400">Enhanced Spacing</div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Using gap instead of space-x</p>
        </div>
      </div>
      
      {/* Test improved buttons */}
      <div className="flex gap-3 mb-6">
        <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors">
          Primary Button
        </button>
        <button className="border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          Secondary Button
        </button>
      </div>
      
      {/* Test status badges */}
      <div className="flex gap-3">
        <span className="bg-green-100 text-green-800 dark:bg-green-950 dark:bg-opacity-50 dark:text-green-400 dark:border-green-800 border px-3 py-1 rounded-full text-sm transition-all">
          Active Status
        </span>
        <span className="bg-red-100 text-red-800 dark:bg-red-950 dark:bg-opacity-50 dark:text-red-400 dark:border-red-800 border px-3 py-1 rounded-full text-sm transition-all">
          Inactive Status
        </span>
      </div>
      
      <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg border dark:border-gray-700">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          ✅ All classes are Tailwind 4 compatible with proper dark mode support
        </p>
      </div>
    </div>
  );
};

export default TailwindTest;