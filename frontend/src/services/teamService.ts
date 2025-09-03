import * as TeamTypes from '../types/team';
import api from './api';

type Team = TeamTypes.Team;
type TeamStats = TeamTypes.TeamStats;
type CreateTeamData = TeamTypes.CreateTeamData;
type UpdateTeamData = TeamTypes.UpdateTeamData;

class TeamService {
  private baseUrl = '/teams';

  async getTeams(): Promise<Team[]> {
    try {
      const response = await api.get(this.baseUrl);
      
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      
      throw new Error('Failed to fetch teams from API');
    } catch (error: any) {
      console.error('Error fetching teams:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to fetch teams. Please ensure the API server is running.');
    }
  }

  async getTeam(id: number): Promise<Team> {
    try {
      const response = await api.get(`${this.baseUrl}/${id}`);
      
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      
      throw new Error('Failed to fetch team from API');
    } catch (error: any) {
      console.error('Error fetching team:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to fetch team. Please ensure the API server is running.');
    }
  }

  async createTeam(teamData: CreateTeamData): Promise<Team> {
    try {
      const response = await api.post(this.baseUrl, teamData);
      
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      
      throw new Error(response.data.message || 'Failed to create team');
    } catch (error: any) {
      console.error('Error creating team:', error.response?.data || error.message);
      
      if (error.response?.status === 400 || error.response?.status === 409) {
        throw new Error(error.response.data.message || 'Validation error');
      }
      
      throw new Error(error.response?.data?.message || 'Failed to create team. Please ensure the API server is running.');
    }
  }

  async updateTeam(id: number, teamData: UpdateTeamData): Promise<Team> {
    try {
      const response = await api.put(`${this.baseUrl}/${id}`, teamData);
      
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      
      throw new Error('Failed to update team');
    } catch (error: any) {
      console.error('Error updating team:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to update team. Please ensure the API server is running.');
    }
  }

  async deleteTeam(id: number): Promise<void> {
    try {
      const response = await api.delete(`${this.baseUrl}/${id}`);
      
      if (!response.data.success) {
        throw new Error('Failed to delete team');
      }
      
      return;
    } catch (error: any) {
      console.error('Error deleting team:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to delete team. Please ensure the API server is running.');
    }
  }

  async getTeamStats(): Promise<TeamStats> {
    try {
      const response = await api.get(`${this.baseUrl}/statistics`);
      
      if (response.data.success && response.data.data) {
        const apiStats = response.data.data.summary;
        return {
          total_teams: apiStats.total_teams,
          active_teams: apiStats.active_teams,
          inactive_teams: apiStats.inactive_teams,
          teams_with_users: apiStats.teams_with_users,
          empty_teams: apiStats.empty_teams
        };
      }
      
      throw new Error('Failed to fetch team statistics');
    } catch (error: any) {
      console.error('Error fetching team stats:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to fetch team statistics. Please ensure the API server is running.');
    }
  }

  async toggleTeamStatus(id: number, is_active: boolean): Promise<Team> {
    return this.updateTeam(id, { is_active });
  }

  async getTeamsSimple(): Promise<Array<{id: number, name: string, member_count: number}>> {
    try {
      const response = await api.get(`${this.baseUrl}/simple`);
      
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      
      throw new Error('Failed to fetch teams list');
    } catch (error: any) {
      console.error('Error fetching teams list:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to fetch teams list. Please ensure the API server is running.');
    }
  }

  async testAPIConnection(): Promise<boolean> {
    try {
      const response = await api.get(`${this.baseUrl}?limit=1`);
      return response.data.success === true;
    } catch {
      try {
        await api.get('/health');
        return true;
      } catch {
        return false;
      }
    }
  }
}

export default new TeamService();