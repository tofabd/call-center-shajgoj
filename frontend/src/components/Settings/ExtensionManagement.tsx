import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search,
  RefreshCw,
  AlertTriangle,
  LoaderCircle,
  Users
} from 'lucide-react';
import { extensionService } from '../../services/extensionService';
import type { Extension } from '../../services/extensionService';

interface ExtensionWithActive extends Extension {
  is_active: boolean;
}

// Map availability_status to user-friendly display
const getStatusFromAvailability = (availabilityStatus: string): string => {
  const statusMap: Record<string, string> = {
    'online': 'online',
    'offline': 'offline', 
    'unknown': 'unknown',
    'invalid': 'invalid'
  };
  return statusMap[availabilityStatus] || 'unknown';
};

const getStatusText = (availabilityStatus: string, statusText?: string): string => {
  // Use backend status_text if available
  if (statusText) {
    return statusText;
  }

  const statusTextMap: Record<string, string> = {
    'online': 'Online',
    'offline': 'Offline',
    'unknown': 'Unknown',
    'invalid': 'Invalid'
  };
  return statusTextMap[availabilityStatus] || 'Unknown';
};

const ExtensionManagement: React.FC = () => {
  const [extensions, setExtensions] = useState<ExtensionWithActive[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingExtension, setEditingExtension] = useState<ExtensionWithActive | null>(null);
  const [deletingExtension, setDeletingExtension] = useState<ExtensionWithActive | null>(null);
  const [deletingExtensionId, setDeletingExtensionId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [showRefreshConfirmation, setShowRefreshConfirmation] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    extension: '',
    agent_name: '',
    team: '',
    is_active: true
  });

  useEffect(() => {
    loadExtensions();
  }, []);

  const loadExtensions = async () => {
    try {
      setLoading(true);
      const data = await extensionService.getExtensions();
      // Use the actual is_active field from the database, default to true if not present
      const extensionsWithActive = data.map(ext => ({
        ...ext,
        is_active: ext.is_active !== undefined ? ext.is_active : true
      }));
      setExtensions(extensionsWithActive);
    } catch (err) {
      toast.error('Failed to load extensions', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: "colored",
      });
      console.error('Error loading extensions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshClick = () => {
    setShowRefreshConfirmation(true);
  };

  const handleRefreshConfirm = async () => {
    setShowRefreshConfirmation(false);
    await handleSync();
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      console.log('🔄 Starting Asterisk extension refresh...');
      
      // Call refresh endpoint (POST method) instead of ExtensionStateList
      const refreshResult = await extensionService.refreshStatus();
      console.log('✅ Extension refresh completed:', refreshResult);
      
      // Add delay to ensure processing completes
      console.log('⏳ Waiting for processing to complete...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Reload extensions from database to get updated data
      console.log('🔄 Loading updated extensions from database...');
      await loadExtensions();
      
      // Show success message with count
      const extensionsCount = refreshResult.extensions || 0;
      const duration = refreshResult.duration_ms || 0;
      toast.success(`Extensions refreshed successfully from Asterisk (${extensionsCount} extensions processed in ${duration}ms)`, {
        position: "top-right",
        autoClose: 4000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: "colored",
      });
    } catch (err) {
      console.error('Error refreshing extensions:', err);
      toast.error('Failed to refresh extensions from Asterisk', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: "colored",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleAdd = async () => {
    try {
      await extensionService.createExtension({
        extension: formData.extension,
        agent_name: formData.agent_name || undefined,
        team: formData.team || undefined
      });
      setIsAddModalOpen(false);
      setFormData({ extension: '', agent_name: '', team: '', is_active: true });
      await loadExtensions();
      
      toast.success(`Extension ${formData.extension} added successfully`, {
        position: "top-right",
        autoClose: 4000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: "colored",
      });
    } catch (err) {
      console.error('Error adding extension:', err);
      toast.error('Failed to add extension', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: "colored",
      });
    }
  };

  const handleEdit = async () => {
    if (!editingExtension) return;
    
    try {
      await extensionService.updateExtension(editingExtension.id, {
        extension: formData.extension,
        agent_name: formData.agent_name || undefined,
        team: formData.team || undefined
      });
      setEditingExtension(null);
      setFormData({ extension: '', agent_name: '', team: '', is_active: true });
      await loadExtensions();
      
      toast.success(`Extension ${formData.extension} updated successfully`, {
        position: "top-right",
        autoClose: 4000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: "colored",
      });
    } catch (err) {
      console.error('Error updating extension:', err);
      toast.error('Failed to update extension', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: "colored",
      });
    }
  };

  const handleDelete = async () => {
    if (!deletingExtension) return;
    
    try {
      // Close the confirmation modal immediately
      setDeletingExtension(null);
      
      // Set the deleting state for this specific extension
      setDeletingExtensionId(deletingExtension.id);
      
      // Call the API to delete the extension
      await extensionService.deleteExtension(deletingExtension.id);
      
      // Remove the extension from local state without refreshing the page
      setExtensions(prev => prev.filter(ext => ext.id !== deletingExtension.id));
      
      // Clear the deleting states
      setDeletingExtensionId(null);
      
      // Show success toast
      toast.success(`Extension ${deletingExtension.extension} deleted successfully`, {
        position: "top-right",
        autoClose: 4000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: "colored",
      });
    } catch (err) {
      console.error('Error deleting extension:', err);
      toast.error('Failed to delete extension', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: "colored",
      });
      // Clear the deleting state on error
      setDeletingExtensionId(null);
    }
  };

  const handleToggleActive = async (extension: ExtensionWithActive) => {
    try {
      // Call the backend API to update is_active field
      await extensionService.updateActiveStatus(extension.id, !extension.is_active);
      
      // Update local state
      setExtensions(prev => 
        prev.map(ext => 
          ext.id === extension.id 
            ? { ...ext, is_active: !ext.is_active }
            : ext
        )
      );
      
      toast.success(`Extension ${extension.extension} ${!extension.is_active ? 'activated' : 'deactivated'} successfully`, {
        position: "top-right",
        autoClose: 4000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: "colored",
      });
    } catch (err) {
      console.error('Error toggling extension active status:', err);
      toast.error('Failed to update extension status', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: "colored",
      });
    }
  };

  const openAddModal = () => {
    setFormData({ extension: '', agent_name: '', team: '', is_active: true });
    setIsAddModalOpen(true);
  };

  const openEditModal = (extension: ExtensionWithActive) => {
    setFormData({
      extension: extension.extension,
      agent_name: extension.agent_name || '',
      team: extension.team || '',
      is_active: extension.is_active
    });
    setEditingExtension(extension);
  };

  const filteredExtensions = extensions.filter(ext =>
    ext.extension.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (ext.agent_name && ext.agent_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (ext.team && ext.team.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Utility function to format date in 12-hour format
  const formatDateTime = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    };
    
    return date.toLocaleString('en-US', options);
  };

  // Team options - updated to match seeder teams
  const teamOptions = [
    { value: '', label: 'No Team' },
    { value: 'Sales', label: 'Sales' },
    { value: 'Support', label: 'Support' },
    { value: 'Marketing', label: 'Marketing' },
    { value: 'Admin', label: 'Admin' }
  ];

  const getTeamColor = (team: string | null) => {
    switch (team) {
      case 'Support':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300';
      case 'Sales':
        return 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300';
      case 'Marketing':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300';
      case 'Admin':
        return 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return '🟢';
      case 'offline':
        return '🔴';
      case 'unknown':
        return '🟡';
      default:
        return '⚪';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'text-green-600 dark:text-green-400';
      case 'offline':
        return 'text-red-600 dark:text-red-400';
      case 'invalid':
        return 'text-orange-600 dark:text-orange-400';
      case 'unknown':
        return 'text-yellow-600 dark:text-yellow-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Extension Management</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage extensions, add/remove users, and control visibility
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
           <button
             onClick={handleRefreshClick}
             disabled={syncing}
             className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
           >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>Refresh from Asterisk</span>
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Extension</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search extensions or agent names..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>



      {/* Extensions Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="h-10 w-10 animate-spin mx-auto mb-4 text-indigo-500" />
            <p className="text-gray-500 dark:text-gray-400 text-lg">Loading extensions...</p>
          </div>
        ) : filteredExtensions.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
              <Users className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-lg mb-2">No extensions found</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm">
              {searchTerm ? 'Try adjusting your search terms' : 'Add your first extension to get started'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
               <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 border-b border-gray-200 dark:border-gray-600">
                 <tr>
                   <th className="px-3 sm:px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                     #
                   </th>
                   <th className="px-3 sm:px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                     Extension
                   </th>
                   <th className="px-3 sm:px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                     Agent
                   </th>
                   <th className="px-3 sm:px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell">
                      Team
                   </th>
                   <th className="px-3 sm:px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                     Status Code
                   </th>
                   <th className="px-3 sm:px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                     Status Text
                   </th>
                   <th className="px-3 sm:px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                     Availability
                   </th>
                   <th className="px-3 sm:px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                     Status Updated
                   </th>
                   <th className="px-3 sm:px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">
                     Active
                   </th>
                   <th className="px-3 sm:px-6 py-4 text-right text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                     Actions
                   </th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                  {filteredExtensions.map((extension, index) => (
                    <tr 
                      key={extension.id} 
                       className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-200 ${
                          deletingExtensionId === extension.id 
                            ? 'bg-red-50 dark:bg-red-950/20 opacity-80' 
                            : 'bg-white dark:bg-gray-800'
                        }`}
                    >
                      {/* Serial Number */}
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          {index + 1}
                        </span>
                      </td>

                      {/* Extension Number */}
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        <span className="text-lg font-mono font-bold text-gray-900 dark:text-white">
                          {extension.extension}
                        </span>
                      </td>

                      {/* Agent */}
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {extension.agent_name || 'Unnamed Agent'}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
                            Created: {formatDateTime(extension.created_at)}
                          </div>
                        </div>
                      </td>

                      {/* Team */}
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                        {extension.team ? (
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getTeamColor(extension.team)}`}>
                            {extension.team}
                          </span>
                         ) : (
                           <span className="text-sm text-gray-400 dark:text-gray-500 italic">No team</span>
                         )}
                      </td>

                      {/* Status Code */}
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {extension.status_code !== undefined ? extension.status_code : -1}
                        </div>
                      </td>

                      {/* Status Text */}
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {extension.status_text || getStatusText(extension.availability_status || 'unknown')}
                        </div>
                      </td>

                      {/* Availability */}
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {!extension.is_active ? (
                            <div className="flex items-center">
                              <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
                              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                Disabled
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center">
                               <div className={`w-2 h-2 rounded-full mr-2 ${
                                 extension.availability_status === 'online' 
                                   ? 'bg-green-500' 
                                   : extension.availability_status === 'offline' 
                                   ? 'bg-red-500' 
                                   : extension.availability_status === 'invalid'
                                   ? 'bg-orange-500'
                                   : 'bg-yellow-500'
                               }`}></div>
                               <span className={`text-sm font-medium capitalize ${getStatusColor(extension.availability_status || 'unknown')}`}>
                                 {extension.availability_status || 'unknown'}
                               </span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Status Updated */}
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {formatDateTime(extension.status_changed_at)}
                        </div>
                        {extension.status_changed_at && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(extension.status_changed_at).toLocaleDateString()}
                          </div>
                        )}
                      </td>

                     {/* Active Toggle */}
                     <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                       <div className="flex items-center">
                         <button
                           onClick={() => handleToggleActive(extension)}
                           disabled={deletingExtensionId === extension.id}
                           className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                             extension.is_active
                               ? 'bg-indigo-600 dark:bg-indigo-500'
                               : 'bg-gray-300 dark:bg-gray-600'
                           }`}
                         >
                           <span
                             className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${
                               extension.is_active ? 'translate-x-6' : 'translate-x-1'
                             }`}
                           />
                         </button>
                         <span className={`ml-3 text-sm font-medium hidden lg:inline ${
                           extension.is_active
                             ? 'text-indigo-600 dark:text-indigo-400'
                             : 'text-gray-500 dark:text-gray-400'
                         }`}>
                           {extension.is_active ? 'Active' : 'Inactive'}
                         </span>
                       </div>
                     </td>

                     {/* Actions */}
                     <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-right">
                       <div className="flex items-center justify-end space-x-1 sm:space-x-2">
                         <button
                           onClick={() => openEditModal(extension)}
                           disabled={deletingExtensionId === extension.id}
                             className={`p-2 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ${
                               deletingExtensionId === extension.id ? 'scale-95' : 'hover:scale-110'
                             }`}
                           title="Edit extension"
                         >
                           <Edit className="h-4 w-4" />
                         </button>
                         <button
                           onClick={() => setDeletingExtension(extension)}
                           disabled={deletingExtensionId === extension.id}
                             className={`p-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ${
                               deletingExtensionId === extension.id ? 'scale-95 animate-pulse' : 'hover:scale-110'
                             }`}
                           title="Delete extension"
                         >
                           {deletingExtensionId === extension.id ? (
                             <LoaderCircle className="h-4 w-4 animate-spin" />
                           ) : (
                             <Trash2 className="h-4 w-4" />
                           )}
                         </button>
                       </div>
                     </td>
                   </tr>
                 ))}
               </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Refresh Confirmation Modal */}
      {showRefreshConfirmation && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-lg mx-4 shadow-2xl">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 bg-yellow-100 dark:bg-yellow-950/50 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Refresh Extensions from Asterisk</h3>
            </div>
            
            <div className="space-y-4 mb-6">
              <div className="bg-yellow-50 dark:bg-yellow-950/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-700">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold text-yellow-800 dark:text-yellow-300 mb-2">Warning: This action will refresh extension data</p>
                    <p className="text-yellow-700 dark:text-yellow-400 mb-3">
                      This operation will query the Asterisk AMI system to update extension status information in real-time.
                    </p>
                    <div className="space-y-2">
                      <div>
                        <p className="font-medium text-yellow-800 dark:text-yellow-300">✓ What will be updated:</p>
                        <ul className="text-yellow-700 dark:text-yellow-400 ml-4 list-disc">
                          <li>Extension online/offline status</li>
                          <li>Device states and availability</li>
                          <li>Last seen timestamps</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-medium text-yellow-800 dark:text-yellow-300">✗ What will NOT be affected:</p>
                        <ul className="text-yellow-700 dark:text-yellow-400 ml-4 list-disc">
                          <li>Agent names and teams</li>
                          <li>Call history and logs</li>
                          <li>Extension configurations</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowRefreshConfirmation(false)}
                className="px-6 py-3 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleRefreshConfirm}
                className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium flex items-center space-x-2"
              >
                <AlertTriangle className="h-4 w-4" />
                <span>Proceed with Refresh</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Extension Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Add New Extension</h3>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Extension Number *
                </label>
                <input
                  type="text"
                  value={formData.extension}
                  onChange={(e) => setFormData({ ...formData, extension: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                  placeholder="e.g., 1001"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Agent Name
                </label>
                <input
                  type="text"
                  value={formData.agent_name}
                  onChange={(e) => setFormData({ ...formData, agent_name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                  placeholder="Agent name"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Team
                </label>
                <select
                  value={formData.team}
                  onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                >
                  {teamOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-8">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-6 py-3 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!formData.extension}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Add Extension
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Extension Modal */}
      {editingExtension && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Edit Extension</h3>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Extension Number *
                </label>
                <input
                  type="text"
                  value={formData.extension}
                  onChange={(e) => setFormData({ ...formData, extension: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Agent Name
                </label>
                <input
                  type="text"
                  value={formData.agent_name}
                  onChange={(e) => setFormData({ ...formData, agent_name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                  placeholder="Agent name"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Team
                </label>
                <select
                  value={formData.team}
                  onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                >
                  {teamOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-8">
              <button
                onClick={() => setEditingExtension(null)}
                className="px-6 py-3 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleEdit}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
              >
                Update Extension
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingExtension && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-950/50 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Delete Extension</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete extension <strong>{deletingExtension.extension}</strong>? 
              This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeletingExtension(null)}
                disabled={deletingExtensionId === deletingExtension?.id}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deletingExtensionId === deletingExtension?.id}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deletingExtensionId === deletingExtension?.id ? (
                  <span>Deleting...</span>
                ) : (
                  <span>Delete Extension</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExtensionManagement;