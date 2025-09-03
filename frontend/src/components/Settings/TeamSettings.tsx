import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Users, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import teamService from '../../services/teamService';
import * as TeamTypes from '../../types/team';

type Team = TeamTypes.Team;
type TeamStats = TeamTypes.TeamStats;

const TeamSettings: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [stats, setStats] = useState<TeamStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Team | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true
  });

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
      setStats(statsData);
      setError(null);
    } catch (err) {
      setError('Failed to load team data');
      console.error('Error loading teams:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    try {
      setSubmitting(true);
      setError(null);

      if (editingTeam) {
        const updated = await teamService.updateTeam(editingTeam._id, formData);
        setTeams(teams.map(t => t._id === editingTeam._id ? updated : t));
      } else {
        const newTeam = await teamService.createTeam(formData);
        setTeams([...teams, newTeam]);
      }
      
      resetForm();
      await loadData(); // Refresh stats
    } catch (err: any) {
      setError(err.message || (editingTeam ? 'Failed to update team' : 'Failed to create team'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (team: Team) => {
    if (submitting) return;

    try {
      setSubmitting(true);
      setError(null);
      await teamService.deleteTeam(team._id);
      setTeams(teams.filter(t => t._id !== team._id));
      setDeleteConfirm(null);
      await loadData(); // Refresh stats
    } catch (err: any) {
      setError(err.message || 'Failed to delete team');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (team: Team) => {
    if (submitting) return;

    try {
      setError(null);
      const updated = await teamService.toggleTeamStatus(team._id, !team.isActive);
      setTeams(teams.map(t => t._id === team._id ? updated : t));
      await loadData(); // Refresh stats
    } catch (err: any) {
      setError(err.message || 'Failed to update team status');
    }
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', isActive: true });
    setEditingTeam(null);
    setShowAddModal(false);
  };

  const startEdit = (team: Team) => {
    setFormData({
      name: team.name,
      description: team.description || '',
      isActive: team.isActive
    });
    setEditingTeam(team);
    setShowAddModal(true);
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
            onClick={() => setShowAddModal(true)}
            disabled={submitting}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Team</span>
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

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg dark:bg-blue-950/50 border dark:border-blue-800">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.total_teams}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Teams</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg dark:bg-green-950/50 border dark:border-green-800">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.active_teams}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Active Teams</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg dark:bg-yellow-950/50 border dark:border-yellow-800">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.inactive_teams}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Inactive Teams</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg dark:bg-purple-950/50 border dark:border-purple-800">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.teams_with_users}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Teams with Users</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg dark:bg-gray-800 border dark:border-gray-700">
              <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">{stats.empty_teams}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Empty Teams</div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map((team) => (
          <div key={team._id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <span className="truncate">{team.name}</span>
                    {team.isActive ? (
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                    )}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">
                    Slug: {team.slug}
                  </p>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => startEdit(team)}
                    disabled={submitting}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50 p-1 rounded transition-colors"
                    title="Edit team"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(team)}
                    disabled={submitting}
                    className="text-gray-400 hover:text-red-600 disabled:opacity-50 p-1 rounded transition-colors"
                    title="Delete team"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {team.description && (
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
                  {team.description}
                </p>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 gap-1">
                  <Users className="h-4 w-4 flex-shrink-0" />
                  <span>{team.userCount || 0} members</span>
                </div>
                <button
                  onClick={() => handleToggleStatus(team)}
                  disabled={submitting}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 disabled:opacity-50 ${
                    team.isActive
                      ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-950/50 dark:text-green-400 dark:hover:bg-green-950/75 border dark:border-green-800'
                      : 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-950/50 dark:text-red-400 dark:hover:bg-red-950/75 border dark:border-red-800'
                  }`}
                >
                  {team.isActive ? 'Active' : 'Inactive'}
                </button>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-400 dark:text-gray-500">
                  <div>Created: {new Date(team.createdAt).toLocaleDateString()}</div>
                  <div>Updated: {new Date(team.updatedAt).toLocaleDateString()}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {teams.length === 0 && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No teams found</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">Get started by creating your first team</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Create Team
          </button>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              {editingTeam ? 'Edit Team' : 'Add New Team'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Team Name *
                </label>
                <input
                  type="text"
                  required
                  disabled={submitting}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 transition-colors"
                  placeholder="Enter team name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  disabled={submitting}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 transition-colors resize-vertical"
                  rows={3}
                  placeholder="Enter team description (optional)"
                />
              </div>
              
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={submitting}
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="disabled:opacity-50 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
                </label>
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={submitting}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors min-w-[80px]"
                >
                  {submitting ? 'Saving...' : (editingTeam ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Delete Team</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Are you sure you want to delete <strong>"{deleteConfirm.name}"</strong>? This action cannot be undone.
            </p>
            {deleteConfirm.userCount && deleteConfirm.userCount > 0 && (
              <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-md p-3 mb-4">
                <p className="text-red-600 dark:text-red-400 text-sm">
                  Warning: This team has {deleteConfirm.userCount} member(s). Please reassign them first.
                </p>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={submitting}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={submitting || (deleteConfirm.userCount && deleteConfirm.userCount > 0)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors min-w-[80px]"
              >
                {submitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamSettings;