import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search,
  RefreshCw,
  AlertTriangle,
  LoaderCircle
} from 'lucide-react';
import { extensionService } from '../../services/extensionService';
import type { Extension } from '../../services/extensionService';

interface ExtensionWithActive extends Extension {
  is_active: boolean;
}

const ExtensionManagement: React.FC = () => {
  const [extensions, setExtensions] = useState<ExtensionWithActive[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingExtension, setEditingExtension] = useState<ExtensionWithActive | null>(null);
  const [deletingExtension, setDeletingExtension] = useState<ExtensionWithActive | null>(null);
  const [deletingExtensionId, setDeletingExtensionId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    extension: '',
    agent_name: '',
    department: '',
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

  const handleSync = async () => {
    try {
      setSyncing(true);
      await extensionService.syncExtensions();
      await loadExtensions();
      
      toast.success('Extensions synced successfully from Asterisk', {
        position: "top-right",
        autoClose: 4000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: "colored",
      });
    } catch (err) {
      console.error('Error syncing extensions:', err);
      toast.error('Failed to sync extensions', {
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
        department: formData.department || undefined
      });
      setIsAddModalOpen(false);
      setFormData({ extension: '', agent_name: '', department: '', is_active: true });
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
        department: formData.department || undefined
      });
      setEditingExtension(null);
      setFormData({ extension: '', agent_name: '', department: '', is_active: true });
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
    setFormData({ extension: '', agent_name: '', department: '', is_active: true });
    setIsAddModalOpen(true);
  };

  const openEditModal = (extension: ExtensionWithActive) => {
    setFormData({
      extension: extension.extension,
      agent_name: extension.agent_name || '',
      department: extension.department || '',
      is_active: extension.is_active
    });
    setEditingExtension(extension);
  };

  const filteredExtensions = extensions.filter(ext =>
    ext.extension.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (ext.agent_name && ext.agent_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (ext.department && ext.department.toLowerCase().includes(searchTerm.toLowerCase()))
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

  // Department options
  const departmentOptions = [
    { value: '', label: 'No Department' },
    { value: 'Support', label: 'Support' },
    { value: 'Sales', label: 'Sales' },
    { value: 'Administration', label: 'Administration' },
    { value: 'General', label: 'General' }
  ];

  const getDepartmentColor = (department: string | null) => {
    switch (department) {
      case 'Support':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'Sales':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'Administration':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'General':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
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
      case 'unknown':
        return 'text-yellow-600 dark:text-yellow-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Extension Management</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage extensions, add/remove users, and control visibility
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>Sync from Asterisk</span>
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
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
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 border-b border-gray-200 dark:border-gray-600">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Extension
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Agent Details
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Last Status Change
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Active
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                {filteredExtensions.map((extension) => (
                  <tr 
                    key={extension.id} 
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-200 ${
                      deletingExtensionId === extension.id 
                        ? 'bg-red-50 dark:bg-red-900/20 opacity-80' 
                        : 'bg-white dark:bg-gray-800'
                    }`}
                  >
                    {/* Extension Number */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-lg font-mono font-bold text-gray-900 dark:text-white">
                        {extension.extension}
                      </span>
                    </td>

                    {/* Agent Details */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {extension.agent_name || 'Unnamed Agent'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Last seen: {formatDateTime(extension.last_seen)}
                        </div>
                      </div>
                    </td>

                    {/* Department */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {extension.department ? (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getDepartmentColor(extension.department)}`}>
                          {extension.department}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400 dark:text-gray-500 italic">No department</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 whitespace-nowrap">
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
                              extension.status === 'online' 
                                ? 'bg-green-500' 
                                : extension.status === 'offline' 
                                ? 'bg-red-500' 
                                : 'bg-yellow-500'
                            }`}></div>
                            <span className={`text-sm font-medium ${getStatusColor(extension.status)}`}>
                              {extension.status}
                            </span>
                            {extension.device_state && extension.device_state !== 'NOT_INUSE' && (
                              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                                ({extension.device_state})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Last Status Change */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {formatDateTime(extension.last_status_change)}
                      </div>
                      {extension.last_status_change && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(extension.last_status_change).toLocaleDateString()}
                        </div>
                      )}
                    </td>

                    {/* Active Toggle */}
                    <td className="px-6 py-4 whitespace-nowrap">
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
                        <span className={`ml-3 text-sm font-medium ${
                          extension.is_active
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {extension.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => openEditModal(extension)}
                          disabled={deletingExtensionId === extension.id}
                          className={`p-2 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ${
                            deletingExtensionId === extension.id ? 'scale-95' : 'hover:scale-110'
                          }`}
                          title="Edit extension"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeletingExtension(extension)}
                          disabled={deletingExtensionId === extension.id}
                          className={`p-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ${
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

      {/* Add Extension Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
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
                  Department
                </label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                >
                  {departmentOptions.map((option) => (
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
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
                  Department
                </label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                >
                  {departmentOptions.map((option) => (
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
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