import React, { useState, useEffect } from 'react';
import { X, Phone, Users, CheckCircle, XCircle, AlertCircle, Server, Search } from 'lucide-react';
import { extensionService } from '../../services/extensionService';
import type { Extension } from '../../services/extensionService';

interface ExtensionsListModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId?: number;
  teamName?: string;
  teamColor?: string;
}

const ExtensionsListModal: React.FC<ExtensionsListModalProps> = ({
  isOpen,
  onClose,
  teamId,
  teamName,
  teamColor = '#6366F1'
}) => {
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadExtensions();
    }
  }, [isOpen, teamId]);

  const loadExtensions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get all extensions and filter by team if teamId is provided
      const allExtensions = await extensionService.getExtensions();
      
      let filteredExtensions = allExtensions;
      if (teamId) {
        filteredExtensions = allExtensions.filter(ext => ext.team_id === teamId);
      }
      
      setExtensions(filteredExtensions);
    } catch (err: any) {
      console.error('Error loading extensions:', err);
      setError('Failed to load extensions');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (availabilityStatus: string) => {
    switch (availabilityStatus) {
      case 'online':
        return 'text-green-600 dark:text-green-400';
      case 'offline':
        return 'text-red-600 dark:text-red-400';
      case 'unknown':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'invalid':
        return 'text-gray-600 dark:text-gray-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getStatusIcon = (availabilityStatus: string) => {
    switch (availabilityStatus) {
      case 'online':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'offline':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'unknown':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'invalid':
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <Server className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadgeColor = (availabilityStatus: string) => {
    switch (availabilityStatus) {
      case 'online':
        return 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300';
      case 'offline':
        return 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300';
      case 'unknown':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-300';
      case 'invalid':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const filteredExtensions = extensions.filter(ext =>
    ext.extension.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (ext.agent_name && ext.agent_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-hidden transform animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: teamColor }}>
                <Phone className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Extensions List
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {teamName ? `Team: ${teamName}` : 'All Extensions'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Statistics Cards - Single Row - Moved to top */}
        {!loading && !error && filteredExtensions.length > 0 && (
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="flex items-center space-x-3 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex-shrink-0">
                  <Phone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">Total</p>
                  <p className="text-lg font-bold text-blue-900 dark:text-blue-100">
                    {filteredExtensions.length}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex-shrink-0">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wider">Online</p>
                  <p className="text-lg font-bold text-green-900 dark:text-green-100">
                    {filteredExtensions.filter(ext => ext.availability_status === 'online').length}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
                <div className="flex-shrink-0">
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wider">Offline</p>
                  <p className="text-lg font-bold text-red-900 dark:text-red-100">
                    {filteredExtensions.filter(ext => ext.availability_status === 'offline').length}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="flex-shrink-0">
                  <Users className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Active</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {filteredExtensions.filter(ext => ext.is_active).length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search extensions or agent names..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-red-600 dark:text-red-400 text-sm font-medium">{error}</p>
              <button
                onClick={loadExtensions}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : filteredExtensions.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Phone className="h-8 w-8 text-gray-400 dark:text-gray-500" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {searchTerm ? 'No extensions found' : (teamName ? `No extensions in ${teamName}` : 'No extensions found')}
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                {searchTerm 
                  ? `No extensions match "${searchTerm}"` 
                  : (teamName 
                    ? 'This team has no extensions assigned yet.' 
                    : 'No extensions are configured in the system.'
                  )
                }
              </p>
            </div>
          ) : (
            <>
              {/* Extensions Table */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Extension
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Agent
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Team
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Availability
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Active
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredExtensions.map((extension) => (
                        <tr key={extension.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center">
                                <Phone className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                              </div>
                              <div className="ml-3">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {extension.extension}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                            {extension.agent_name || (
                              <span className="italic text-gray-400 dark:text-gray-500">Not assigned</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                            {extension.team_name || (
                              <span className="italic text-gray-400 dark:text-gray-500">No team</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              {getStatusIcon(extension.availability_status)}
                              <span className="text-sm text-gray-600 dark:text-gray-300">
                                {extension.status_text || extension.statusLabel || 'Unknown'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusBadgeColor(extension.availability_status)}`}>
                              {extension.availability_status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              extension.is_active
                                ? 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300'
                                : 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300'
                            }`}>
                              {extension.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExtensionsListModal;