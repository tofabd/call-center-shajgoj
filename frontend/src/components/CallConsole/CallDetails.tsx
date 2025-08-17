import React from 'react';
import { ShoppingBag } from 'lucide-react';

interface CallDetailsProps {
  selectedCallId: number | null;
}

export type { CallDetailsProps };

const CallDetails: React.FC<CallDetailsProps> = ({ selectedCallId }) => {
  return (
    <div className="flex flex-col h-full">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col h-full">
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-gray-800 dark:to-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-600 rounded-lg">
                <ShoppingBag className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Call Details</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedCallId ? 'Details for selected call' : 'Select a call to view details'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {!selectedCallId ? (
          <div className="p-8 flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShoppingBag className="h-10 w-10 text-gray-400" />
              </div>
              <h4 className="text-gray-900 dark:text-white font-medium text-lg mb-2">No Call Selected</h4>
              <p className="text-gray-500 dark:text-gray-400">Select a call from the incoming calls list to view details</p>
            </div>
          </div>
        ) : (
          <div className="p-8 flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-100 dark:bg-blue-700 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShoppingBag className="h-10 w-10 text-blue-400" />
              </div>
              <h4 className="text-gray-900 dark:text-white font-medium text-lg mb-2">Call Selected</h4>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CallDetails;


