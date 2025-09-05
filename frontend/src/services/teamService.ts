import * as TeamTypes from '../types/team';
import api from './api';

type Team = TeamTypes.Team;
type TeamStats = TeamTypes.TeamStats;
type TeamStatsResponse = TeamTypes.TeamStatsResponse;
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
      
      if (error.response?.status === 400 || error.response?.status === 409 || error.response?.status === 422) {
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

  async getTeamStats(): Promise<TeamStatsResponse> {
    try {
      const response = await api.get(`${this.baseUrl}/statistics`);
      
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      
      throw new Error('Failed to fetch team statistics');
    } catch (error: any) {
      console.error('Error fetching team stats:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to fetch team statistics. Please ensure the API server is running.');
    }
  }

  async toggleTeamStatus(id: number): Promise<{ id: string; is_active: boolean }> {
    try {
      const response = await api.post(`${this.baseUrl}/${id}/toggle-active`);
      
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      
      throw new Error('Failed to toggle team status');
    } catch (error: any) {
      console.error('Error toggling team status:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to toggle team status. Please ensure the API server is running.');
    }
  }

  async getTeamsSimple(): Promise<Array<{id: number, name: string, extensions_count: number}>> {
    try {
      const teams = await this.getTeams();
      return teams.map(team => ({
        id: team.id,
        name: team.name,
        extensions_count: team.extensions_count
      }));
    } catch (error: any) {
      console.error('Error fetching teams list:', error);
      throw new Error('Failed to fetch teams list. Please ensure the API server is running.');
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