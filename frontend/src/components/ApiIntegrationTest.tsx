import React, { useState } from 'react';
import { useLiveCallsEnhanced } from '../hooks/useLiveCallsEnhanced';
import { callService } from '../services/callService';
import { Phone, Activity, Clock, PhoneCall, RefreshCw } from 'lucide-react';

interface ApiTestResult {
  endpoint: string;
  status: 'pending' | 'success' | 'error';
  data?: object;
  error?: string;
  duration?: number;
}

const ApiIntegrationTest: React.FC = () => {
  const [testResults, setTestResults] = useState<ApiTestResult[]>([]);
  const [testing, setTesting] = useState(false);
  
  // Get hook data (some variables unused but available for future features)
  const {
    liveCalls,
    loading,
    error,
    lastUpdated,
    activeCalls,
    ringingCalls, // Available for future use
    answeredCalls, // Available for future use
    isPolling,
    refetch // Available for future use
  } = useLiveCallsEnhanced({
    pollInterval: 3000,
    autoRefresh: true,
    onDataUpdate: (calls) => {
      console.log('Hook data update:', calls.length, 'calls');
    },
    onError: (error) => {
      console.error('Hook error:', error);
    }
  });

  const runApiTests = async () => {
    setTesting(true);
    setTestResults([]);
    
    const tests = [
      {
        name: 'GET /api/calls/live',
        test: () => callService.getLiveCalls()
      },
      {
        name: 'GET /api/calls/statistics',
        test: () => callService.getCallStatistics()
      },
      {
        name: 'GET /api/calls (paginated)',
        test: () => callService.getCalls({ page: 1, limit: 10 })
      }
    ];

    for (const testCase of tests) {
      const result: ApiTestResult = {
        endpoint: testCase.name,
        status: 'pending'
      };
      
      setTestResults(prev => [...prev, result]);
      
      try {
        const startTime = Date.now();
        const data = await testCase.test();
        const duration = Date.now() - startTime;
        
        result.status = 'success';
        result.data = data;
        result.duration = duration;
        
        setTestResults(prev => 
          prev.map(r => r.endpoint === result.endpoint ? result : r)
        );
      } catch (error) {
        result.status = 'error';
        result.error = error instanceof Error ? error.message : 'Unknown error';
        
        setTestResults(prev => 
          prev.map(r => r.endpoint === result.endpoint ? result : r)
        );
      }
    }
    
    setTesting(false);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">API Integration Test</h2>
            <p className="text-gray-600 dark:text-gray-400">Test real-time connection to MongoDB API</p>
          </div>
          <button
            onClick={runApiTests}
            disabled={testing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
          >
            <RefreshCw className={`h-4 w-4 ${testing ? 'animate-spin' : ''}`} />
            <span>{testing ? 'Testing...' : 'Run Tests'}</span>
          </button>
        </div>

        {/* API Connection Status */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-blue-900 dark:text-blue-100">API Status</span>
            </div>
            <p className={`text-sm mt-1 ${
              error ? 'text-red-600' : isPolling ? 'text-green-600' : 'text-yellow-600'
            }`}>
              {error ? 'Error' : isPolling ? 'Connected' : 'Disconnected'}
            </p>
          </div>
          
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <Phone className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-900 dark:text-green-100">Total Calls</span>
            </div>
            <p className="text-2xl font-bold text-green-600 mt-1">{liveCalls.length}</p>
          </div>
          
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <PhoneCall className="h-5 w-5 text-yellow-600" />
              <span className="font-medium text-yellow-900 dark:text-yellow-100">Active Calls</span>
            </div>
            <p className="text-2xl font-bold text-yellow-600 mt-1">{activeCalls.length}</p>
          </div>
          
          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-purple-600" />
              <span className="font-medium text-purple-900 dark:text-purple-100">Last Update</span>
            </div>
            <p className="text-sm text-purple-600 mt-1">
              {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Never'}
            </p>
          </div>
        </div>

        {/* Test Results */}
        {testResults.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Test Results</h3>
            {testResults.map((result, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      result.status === 'success' ? 'bg-green-500' :
                      result.status === 'error' ? 'bg-red-500' : 'bg-yellow-500 animate-pulse'
                    }`}></div>
                    <span className="font-medium">{result.endpoint}</span>
                    {result.duration && (
                      <span className="text-sm text-gray-500">({result.duration}ms)</span>
                    )}
                  </div>
                  <span className={`text-sm font-medium ${
                    result.status === 'success' ? 'text-green-600' :
                    result.status === 'error' ? 'text-red-600' : 'text-yellow-600'
                  }`}>
                    {result.status.toUpperCase()}
                  </span>
                </div>
                
                {result.error && (
                  <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-600">
                    {result.error}
                  </div>
                )}
                
                {result.data && (
                  <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded text-sm">
                    <details>
                      <summary className="cursor-pointer font-medium">View Response Data</summary>
                      <pre className="mt-2 text-xs overflow-auto">
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Live Calls Preview */}
        {activeCalls.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Live Calls Preview</h3>
            <div className="space-y-2">
              {activeCalls.slice(0, 5).map((call) => (
                <div key={call.id || call._id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${
                      call.status === 'answered' ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'
                    }`}></div>
                    <span className="font-mono">{call.caller_number || 'Unknown'}</span>
                    <span className="text-sm text-gray-500">→ Ext {call.agent_exten || '-'}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs rounded ${
                      call.direction === 'incoming' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {call.direction || 'unknown'}
                    </span>
                    <span className="text-sm font-medium">{call.status}</span>
                  </div>
                </div>
              ))}
              {activeCalls.length > 5 && (
                <p className="text-sm text-gray-500 text-center">
                  ... and {activeCalls.length - 5} more calls
                </p>
              )}
            </div>
          </div>
        )}

        {loading && (
          <div className="text-center py-4">
            <div className="inline-flex items-center space-x-2 text-gray-600">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Loading live calls...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiIntegrationTest;