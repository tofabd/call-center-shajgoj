import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Plus, Edit2, Trash2, Users, CheckCircle, XCircle, AlertTriangle, Server, LoaderCircle } from 'lucide-react';
import teamService from '../../services/teamService';
import * as TeamTypes from '../../types/team';
import ExtensionsListModal from './ExtensionsListModal';

type Team = TeamTypes.Team;
type TeamStatsResponse = TeamTypes.TeamStatsResponse;

// Color palette for teams
const TEAM_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', 
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
  '#F97316', '#6366F1', '#14B8A6', '#F43F5E',
  '#9333EA', '#D97706', '#059669', '#DC2626'
];

// Helper function to get random color
const getRandomColor = (): string => {
  return TEAM_COLORS[Math.floor(Math.random() * TEAM_COLORS.length)];
};

// Helper function to get light color styling based on team color
const getTeamLightColor = (color: string): string => {
  // Convert hex to lighter variant for background and keep text darker
  const colorMap: Record<string, string> = {
    '#3B82F6': 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300', // Blue
    '#EF4444': 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300', // Red
    '#10B981': 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300', // Green
    '#F59E0B': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-300', // Yellow
    '#8B5CF6': 'bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300', // Purple
    '#EC4899': 'bg-pink-100 text-pink-800 dark:bg-pink-950/50 dark:text-pink-300', // Pink
    '#06B6D4': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-300', // Cyan
    '#84CC16': 'bg-lime-100 text-lime-800 dark:bg-lime-950/50 dark:text-lime-300', // Lime
    '#F97316': 'bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300', // Orange
    '#6366F1': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300', // Indigo
    '#14B8A6': 'bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300', // Teal
    '#F43F5E': 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300', // Rose
    '#9333EA': 'bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300', // Violet
    '#D97706': 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300', // Amber
    '#059669': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300', // Emerald
    '#DC2626': 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300', // Red variant
  };
  
  return colorMap[color] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
};

// Helper function to generate slug from name
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

const TeamSettings: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [statsResponse, setStatsResponse] = useState<TeamStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Team | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingTeamId, setDeletingTeamId] = useState<number | null>(null);
  const [showExtensionsModal, setShowExtensionsModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    color: '#3B82F6',
    is_active: true
  });
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);


  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [teamsData, statsData] = await Promise.all([
        teamService.getTeams(),
        teamService.getTeamStats()
      ]);
      setTeams(teamsData);
      setStatsResponse(statsData);
      setError(null);
    } catch (err) {
      setError('Failed to load team data');
      toast.error('Failed to load team data', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: "colored",
      });
      console.error('Error loading teams:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    // Client-side validation
    if (!formData.name.trim()) {
      setError('Team name is required');
      return;
    }

    if (formData.name.length > 255) {
      setError('Team name cannot exceed 255 characters');
      return;
    }

    if (formData.slug.trim() && !/^[a-z0-9-]+$/.test(formData.slug)) {
      setError('Slug can only contain lowercase letters, numbers, and hyphens');
      return;
    }

    if (formData.slug.length > 100) {
      setError('Slug cannot exceed 100 characters');
      return;
    }

    if (formData.description && formData.description.length > 1000) {
      setError('Description cannot exceed 1000 characters');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // Prepare data for API
      const submitData: any = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        color: formData.color,
        is_active: formData.is_active
      };

      // Include slug if it's provided (for new teams or manual edits)
      if (formData.slug.trim()) {
        submitData.slug = formData.slug.trim();
      }

      if (editingTeam) {
        const updated = await teamService.updateTeam(editingTeam.id, submitData);
        setTeams(teams.map(t => t.id === editingTeam.id ? updated : t));
        toast.success(`Team "${updated.name}" updated successfully`, {
          position: "top-right",
          autoClose: 4000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          theme: "colored",
        });
      } else {
        const newTeam = await teamService.createTeam(submitData);
        setTeams([...teams, newTeam]);
        toast.success(`Team "${newTeam.name}" created successfully`, {
          position: "top-right",
          autoClose: 4000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          theme: "colored",
        });
      }
      
      resetForm();
      
      // Refresh stats only 
      try {
        const statsData = await teamService.getTeamStats();
        setStatsResponse(statsData);
      } catch (err) {
        console.error('Error refreshing stats:', err);
      }
    } catch (err: any) {
      toast.error(err.message || (editingTeam ? 'Failed to update team' : 'Failed to create team'), {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: "colored",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    
    try {
      // Close the confirmation modal immediately
      setDeleteConfirm(null);
      
      // Set the deleting state for this specific team
      setDeletingTeamId(deleteConfirm.id);
      
      // Call the API to delete the team
      await teamService.deleteTeam(deleteConfirm.id);
      
      // Remove the team from local state without refreshing the page
      setTeams(prev => prev.filter(t => t.id !== deleteConfirm.id));
      
      // Clear the deleting state
      setDeletingTeamId(null);
      
      // Show success toast
      toast.success(`Team "${deleteConfirm.name}" deleted successfully`, {
        position: "top-right",
        autoClose: 4000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: "colored",
      });
      
      // Refresh stats only
      try {
        const statsData = await teamService.getTeamStats();
        setStatsResponse(statsData);
      } catch (err) {
        console.error('Error refreshing stats:', err);
      }
    } catch (err: any) {
      console.error('Error deleting team:', err);
      toast.error('Failed to delete team', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: "colored",
      });
      // Clear the deleting state on error
      setDeletingTeamId(null);
    }
  };

  const handleToggleStatus = async (team: Team) => {
    if (submitting) return;

    try {
      setError(null);
      const updated = await teamService.toggleTeamStatus(team.id);
      setTeams(teams.map(t => t.id === team.id ? { ...t, is_active: updated.is_active } : t));
      await loadData(); // Refresh stats
    } catch (err: any) {
      setError(err.message || 'Failed to update team status');
    }
  };

  const handleShowExtensions = (team: Team) => {
    setSelectedTeam(team);
    setShowExtensionsModal(true);
  };

  const handleCloseExtensionsModal = () => {
    setShowExtensionsModal(false);
    setSelectedTeam(null);
  };

  const resetForm = () => {
    setFormData({ name: '', slug: '', description: '', color: getRandomColor(), is_active: true });
    setEditingTeam(null);
    setShowAddModal(false);
    setIsSlugManuallyEdited(false);
    setError(null); // Clear any form errors
  };

  const startEdit = (team: Team) => {
    setFormData({
      name: team.name,
      slug: team.slug,
      description: team.description || '',
      color: team.color || '#3B82F6',
      is_active: team.is_active
    });
    setEditingTeam(team);
    setIsSlugManuallyEdited(false);
    setShowAddModal(true);
  };

  // Handle name changes and auto-generate slug
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setFormData(prev => {
      const updates = { ...prev, name: newName };
      
      // Auto-generate slug for new teams when name changes, unless user has manually edited it
      if (!editingTeam && !isSlugManuallyEdited) {
        updates.slug = generateSlug(newName);
      }
      
      return updates;
    });
  };

  // Handle slug changes
  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newSlug = e.target.value.toLowerCase();
    // Only allow valid slug characters as user types
    newSlug = newSlug.replace(/[^a-z0-9-]/g, '');
    
    setFormData(prev => ({ ...prev, slug: newSlug }));
    
    // Mark that the user has manually edited the slug (only for new teams)
    if (!editingTeam) {
      setIsSlugManuallyEdited(true);
    }
  };



  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Team Management</h2>
          <button
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
            disabled={submitting}
            className="group relative overflow-hidden bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg font-medium shadow-sm hover:shadow-md transform hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className="relative flex items-center gap-2">
              <Plus className="h-4 w-4 group-hover:rotate-90 transition-transform duration-300" />
              <span>Add Team</span>
            </div>
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 dark:bg-red-950/50 dark:border-red-800 dark:text-red-400">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {statsResponse?.stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="group bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 p-4 rounded-xl shadow-sm hover:shadow-md transform hover:-translate-y-0.5 transition-all duration-200">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{statsResponse.stats.total_teams}</div>
              </div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-2">Total Teams</div>
            </div>
            <div className="group bg-white dark:bg-gray-800 border border-emerald-200 dark:border-emerald-800 p-4 rounded-xl shadow-sm hover:shadow-md transform hover:-translate-y-0.5 transition-all duration-200">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{statsResponse.stats.active_teams}</div>
              </div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-2">Active Teams</div>
            </div>
            <div className="group bg-white dark:bg-gray-800 border border-orange-200 dark:border-orange-800 p-4 rounded-xl shadow-sm hover:shadow-md transform hover:-translate-y-0.5 transition-all duration-200">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/50 rounded-lg flex items-center justify-center">
                  <XCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{statsResponse.stats.inactive_teams}</div>
              </div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-2">Inactive Teams</div>
            </div>
            <div className="group bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-800 p-4 rounded-xl shadow-sm hover:shadow-md transform hover:-translate-y-0.5 transition-all duration-200">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/50 rounded-lg flex items-center justify-center">
                  <Server className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{statsResponse.stats.teams_with_extensions}</div>
              </div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-2">Teams with Extensions</div>
            </div>
            <div className="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-xl shadow-sm hover:shadow-md transform hover:-translate-y-0.5 transition-all duration-200">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </div>
                <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">{statsResponse.stats.teams_without_extensions}</div>
              </div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-2">Empty Teams</div>
            </div>
          </div>
        )}
      </div>

      {/* Teams Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">        
        {teams.length === 0 ? (
          <div className="text-center py-16">
            <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No teams found</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Get started by creating your first team to organize extensions</p>
            <button
              onClick={() => {
                resetForm();
                setShowAddModal(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
            >
              <Plus className="h-4 w-4 inline mr-2" />
              Create Your First Team
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
               <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Team
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Slug
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Extensions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                 {teams.map((team, index) => (
                   <tr 
                     key={team.id} 
                     className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-200 ${
                       deletingTeamId === team.id 
                         ? 'bg-red-50 dark:bg-red-950/20 opacity-80' 
                         : 'bg-white dark:bg-gray-800'
                     }`}
                   >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-medium">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getTeamLightColor(team.color || '#6366F1')}`}>
                        {team.name}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600 dark:text-gray-300 font-mono bg-gray-100 dark:bg-gray-700 px-2.5 py-1 rounded-md">
                        {team.slug}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 max-w-xs">
                      <div className="truncate">
                        {team.description || (
                          <span className="italic text-gray-400 dark:text-gray-500">No description</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleShowExtensions(team)}
                        className="flex items-center hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-2 rounded-lg transition-all duration-200 group"
                        title="View extensions in this team"
                      >
                        <div className="flex-shrink-0 w-2 h-2 rounded-full bg-indigo-500 mr-2 group-hover:bg-indigo-600"></div>
                        <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 font-medium">
                          {team.extensions_count || 0} extension{(team.extensions_count || 0) !== 1 ? 's' : ''}
                        </span>
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(team.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                         <button
                           onClick={() => handleToggleStatus(team)}
                           disabled={deletingTeamId === team.id}
                           className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                             team.is_active
                               ? 'bg-indigo-600 dark:bg-indigo-500'
                               : 'bg-gray-300 dark:bg-gray-600'
                           }`}
                         >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${
                              team.is_active ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                        <span className={`ml-3 text-sm font-medium ${
                          team.is_active
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {team.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center justify-end space-x-2">
                         <button
                           onClick={() => startEdit(team)}
                           disabled={deletingTeamId === team.id}
                           className={`text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:text-indigo-300 dark:hover:bg-indigo-900/20 disabled:opacity-50 disabled:cursor-not-allowed p-1.5 rounded-lg transition-all duration-200 ${
                             deletingTeamId === team.id ? 'scale-95' : 'hover:scale-110'
                           }`}
                           title="Edit team"
                         >
                           <Edit2 className="h-4 w-4" />
                         </button>
                         <button
                           onClick={() => setDeleteConfirm(team)}
                           disabled={deletingTeamId === team.id}
                           className={`text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed p-1.5 rounded-lg transition-all duration-200 ${
                             deletingTeamId === team.id ? 'scale-95 animate-pulse' : 'hover:scale-110'
                           }`}
                           title="Delete team"
                         >
                           {deletingTeamId === team.id ? (
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

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 w-full max-w-lg max-h-[90vh] overflow-y-auto transform animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center">
                  {editingTeam ? (
                    <Edit2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  ) : (
                    <Plus className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  )}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {editingTeam ? 'Edit Team' : 'Create New Team'}
                </h3>
              </div>
            </div>
            
            {error && (
              <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg dark:bg-red-950/50 dark:border-red-800 dark:text-red-400">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Team Name *
                </label>
                <input
                  type="text"
                  required
                  disabled={submitting}
                  value={formData.name}
                  onChange={handleNameChange}
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:opacity-50 transition-all duration-200"
                  placeholder="Enter team name"
                  maxLength={255}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Team Slug
                </label>
                <div className="relative">
                  <input
                    type="text"
                    disabled={submitting}
                    value={formData.slug}
                    onChange={handleSlugChange}
                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:opacity-50 transition-all duration-200 font-mono text-sm"
                    placeholder="team-slug"
                    maxLength={100}
                    pattern="^[a-z0-9-]+$"
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {!editingTeam && (isSlugManuallyEdited ? '✏️ Manually edited' : '🤖 Auto-generated')}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  disabled={submitting}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:opacity-50 transition-all duration-200 resize-none"
                  rows={3}
                  placeholder="Describe the team's purpose..."
                  maxLength={1000}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Team Color
                  </label>
                  <div className="space-y-2">
                    <input
                      type="color"
                      disabled={submitting}
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 cursor-pointer"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Status
                  </label>
                  <div className="mt-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={submitting}
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="relative w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      <span className="ml-3 text-sm text-gray-700 dark:text-gray-300">
                        {formData.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={submitting}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors min-w-[100px]"
                >
                  {submitting ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white mr-2"></div>
                      Saving...
                    </div>
                  ) : (
                    editingTeam ? 'Update' : 'Create'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md transform animate-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-red-50 dark:bg-red-900/20 rounded-t-2xl">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Team</h3>
                  <p className="text-sm text-red-600 dark:text-red-400">This action cannot be undone</p>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <p className="text-gray-700 dark:text-gray-300 mb-3">
                  Are you sure you want to delete the team{' '}
                  <span 
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium text-white"
                    style={{backgroundColor: deleteConfirm.color || '#6366F1'}}
                  >
                    <Users className="h-3.5 w-3.5 mr-1" />
                    {deleteConfirm.name}
                  </span>
                  ?
                </p>
              </div>
              
              {deleteConfirm.extensions_count && deleteConfirm.extensions_count > 0 && (
                <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-amber-800 dark:text-amber-300 text-sm font-medium">
                        Cannot delete team
                      </p>
                      <p className="text-amber-700 dark:text-amber-400 text-sm">
                        This team has {deleteConfirm.extensions_count} extension{deleteConfirm.extensions_count > 1 ? 's' : ''}. Please reassign them first.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  disabled={deletingTeamId === deleteConfirm?.id}
                  className="px-4 py-2.5 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deletingTeamId === deleteConfirm?.id || (deleteConfirm.extensions_count !== undefined && deleteConfirm.extensions_count > 0)}
                  className="px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium transition-all duration-200 min-w-[90px]"
                >
                  {deletingTeamId === deleteConfirm?.id ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white mr-2"></div>
                      Deleting...
                    </div>
                  ) : (
                    'Delete Team'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Extensions List Modal */}
      <ExtensionsListModal
        isOpen={showExtensionsModal}
        onClose={handleCloseExtensionsModal}
        teamId={selectedTeam?.id}
        teamName={selectedTeam?.name}
        teamColor={selectedTeam?.color}
      />
    </div>
  );
};

export default TeamSettings;