import * as TeamTypes from '../types/team';
import api from './api';

// Dummy data for fallback
const DUMMY_TEAMS: Team[] = [
  {
    _id: '1',
    name: 'Sales Team',
    slug: 'sales-team',
    description: 'Handles all sales activities and customer acquisition',
    isActive: true,
    userCount: 8,
    users: [],
    createdAt: new Date('2024-01-15T10:00:00Z').toISOString(),
    updatedAt: new Date('2024-01-20T15:30:00Z').toISOString()
  },
  {
    _id: '2',
    name: 'Support Team',
    slug: 'support-team',
    description: 'Customer support and technical assistance',
    isActive: true,
    userCount: 12,
    users: [],
    createdAt: new Date('2024-01-16T09:00:00Z').toISOString(),
    updatedAt: new Date('2024-01-25T14:20:00Z').toISOString()
  },
  {
    _id: '3',
    name: 'Marketing Team',
    slug: 'marketing-team',
    description: 'Digital marketing and brand promotion',
    isActive: true,
    userCount: 6,
    users: [],
    createdAt: new Date('2024-01-17T11:00:00Z').toISOString(),
    updatedAt: new Date('2024-01-22T16:45:00Z').toISOString()
  },
  {
    _id: '4',
    name: 'Quality Assurance',
    slug: 'quality-assurance',
    description: 'Quality control and compliance monitoring',
    isActive: false,
    userCount: 4,
    users: [],
    createdAt: new Date('2024-01-18T13:00:00Z').toISOString(),
    updatedAt: new Date('2024-01-28T12:10:00Z').toISOString()
  }
];

const DUMMY_STATS: TeamStats = {
  total_teams: 4,
  active_teams: 3,
  inactive_teams: 1,
  teams_with_users: 3,
  empty_teams: 0
};

type Team = TeamTypes.Team;
type TeamStats = TeamTypes.TeamStats;
type CreateTeamData = TeamTypes.CreateTeamData;
type UpdateTeamData = TeamTypes.UpdateTeamData;

// Transform API response to frontend format
const transformTeamFromAPI = (apiTeam: any): Team => {
  return {
    _id: apiTeam._id,
    name: apiTeam.name,
    slug: apiTeam.name.toLowerCase().replace(/\s+/g, '-'),
    description: apiTeam.description || '',
    isActive: apiTeam.is_active,
    userCount: apiTeam.member_count || 0,
    users: apiTeam.members ? apiTeam.members.map((member: any) => ({
      _id: member._id,
      name: member.name,
      email: member.email,
      teamId: apiTeam._id
    })) : [],
    createdAt: apiTeam.createdAt,
    updatedAt: apiTeam.updatedAt
  };
};

// Transform frontend data to API format
const transformTeamToAPI = (teamData: CreateTeamData | UpdateTeamData) => {
  return {
    name: teamData.name,
    description: teamData.description || '',
    is_active: teamData.isActive !== undefined ? teamData.isActive : true,
    updated_by: 'frontend_user' // This should come from auth context in real app
  };
};

class TeamService {
  private baseUrl = '/teams';
  private useAPI = false; // Toggle this based on API availability

  private async checkAPIAvailability(): Promise<boolean> {
    try {
      await api.get('/health');
      return true;
    } catch {
      return false;
    }
  }

  async getTeams(): Promise<Team[]> {
    // Check if we should try the API
    if (this.useAPI) {
      try {
        const response = await api.get(this.baseUrl);
        
        if (response.data.success && response.data.data) {
          return response.data.data.map(transformTeamFromAPI);
        }
        
        throw new Error('Failed to fetch teams');
      } catch (error: any) {
        console.warn('API not available, falling back to dummy data:', error.message);
        this.useAPI = false;
      }
    }
    
    // Fallback to dummy data
    return Promise.resolve([...DUMMY_TEAMS]);
  }

  async getTeam(id: string): Promise<Team> {
    if (this.useAPI) {
      try {
        const response = await api.get(`${this.baseUrl}/${id}`);
        
        if (response.data.success && response.data.data) {
          return transformTeamFromAPI(response.data.data);
        }
        
        throw new Error('Failed to fetch team');
      } catch (error: any) {
        console.warn('API not available, falling back to dummy data:', error.message);
        this.useAPI = false;
      }
    }
    
    // Fallback to dummy data
    const team = DUMMY_TEAMS.find(t => t._id === id);
    if (!team) {
      throw new Error('Team not found');
    }
    return Promise.resolve({ ...team });
  }

  async createTeam(teamData: CreateTeamData): Promise<Team> {
    if (this.useAPI) {
      try {
        const apiData = transformTeamToAPI(teamData);
        const response = await api.post(this.baseUrl, apiData);
        
        if (response.data.success && response.data.data) {
          return transformTeamFromAPI(response.data.data);
        }
        
        throw new Error('Failed to create team');
      } catch (error: any) {
        console.warn('API not available, simulating team creation:', error.message);
        this.useAPI = false;
      }
    }
    
    // Simulate creation with dummy data
    const newTeam: Team = {
      _id: Date.now().toString(),
      name: teamData.name,
      slug: teamData.name.toLowerCase().replace(/\s+/g, '-'),
      description: teamData.description || '',
      isActive: teamData.isActive !== undefined ? teamData.isActive : true,
      userCount: 0,
      users: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    DUMMY_TEAMS.push(newTeam);
    DUMMY_STATS.total_teams += 1;
    if (newTeam.isActive) {
      DUMMY_STATS.active_teams += 1;
    } else {
      DUMMY_STATS.inactive_teams += 1;
    }
    
    return Promise.resolve({ ...newTeam });
  }

  async updateTeam(id: string, teamData: UpdateTeamData): Promise<Team> {
    if (this.useAPI) {
      try {
        const apiData = transformTeamToAPI(teamData);
        const response = await api.put(`${this.baseUrl}/${id}`, apiData);
        
        if (response.data.success && response.data.data) {
          return transformTeamFromAPI(response.data.data);
        }
        
        throw new Error('Failed to update team');
      } catch (error: any) {
        console.warn('API not available, simulating team update:', error.message);
        this.useAPI = false;
      }
    }
    
    // Simulate update with dummy data
    const teamIndex = DUMMY_TEAMS.findIndex(t => t._id === id);
    if (teamIndex === -1) {
      throw new Error('Team not found');
    }
    
    const wasActive = DUMMY_TEAMS[teamIndex].isActive;
    const updatedTeam = {
      ...DUMMY_TEAMS[teamIndex],
      ...teamData,
      slug: teamData.name ? teamData.name.toLowerCase().replace(/\s+/g, '-') : DUMMY_TEAMS[teamIndex].slug,
      updatedAt: new Date().toISOString()
    };
    
    DUMMY_TEAMS[teamIndex] = updatedTeam;
    
    // Update stats if active status changed
    if (wasActive !== updatedTeam.isActive) {
      if (updatedTeam.isActive) {
        DUMMY_STATS.active_teams += 1;
        DUMMY_STATS.inactive_teams -= 1;
      } else {
        DUMMY_STATS.active_teams -= 1;
        DUMMY_STATS.inactive_teams += 1;
      }
    }
    
    return Promise.resolve({ ...updatedTeam });
  }

  async deleteTeam(id: string): Promise<void> {
    if (this.useAPI) {
      try {
        const response = await api.delete(`${this.baseUrl}/${id}`);
        
        if (!response.data.success) {
          throw new Error('Failed to delete team');
        }
        return;
      } catch (error: any) {
        console.warn('API not available, simulating team deletion:', error.message);
        this.useAPI = false;
      }
    }
    
    // Simulate deletion with dummy data
    const teamIndex = DUMMY_TEAMS.findIndex(t => t._id === id);
    if (teamIndex === -1) {
      throw new Error('Team not found');
    }
    
    const team = DUMMY_TEAMS[teamIndex];
    if (team.userCount > 0) {
      throw new Error('Cannot delete team with members');
    }
    
    DUMMY_TEAMS.splice(teamIndex, 1);
    DUMMY_STATS.total_teams -= 1;
    if (team.isActive) {
      DUMMY_STATS.active_teams -= 1;
    } else {
      DUMMY_STATS.inactive_teams -= 1;
    }
    
    return Promise.resolve();
  }

  async getTeamStats(): Promise<TeamStats> {
    if (this.useAPI) {
      try {
        const response = await api.get(`${this.baseUrl}/statistics`);
        
        if (response.data.success && response.data.data) {
          const apiStats = response.data.data.summary;
          return {
            total_teams: apiStats.total_teams,
            active_teams: apiStats.active_teams,
            inactive_teams: apiStats.inactive_teams,
            teams_with_users: apiStats.total_teams - (apiStats.capacity_warnings || 0), // Approximate
            empty_teams: apiStats.total_teams - apiStats.active_teams // Approximate
          };
        }
        
        throw new Error('Failed to fetch team statistics');
      } catch (error: any) {
        console.warn('API not available, falling back to dummy stats:', error.message);
        this.useAPI = false;
      }
    }
    
    // Recalculate stats from dummy data
    const activeTeams = DUMMY_TEAMS.filter(t => t.isActive).length;
    const teamsWithUsers = DUMMY_TEAMS.filter(t => t.userCount > 0).length;
    
    return Promise.resolve({
      total_teams: DUMMY_TEAMS.length,
      active_teams: activeTeams,
      inactive_teams: DUMMY_TEAMS.length - activeTeams,
      teams_with_users: teamsWithUsers,
      empty_teams: DUMMY_TEAMS.length - teamsWithUsers
    });
  }

  async toggleTeamStatus(id: string, isActive: boolean): Promise<Team> {
    return this.updateTeam(id, { isActive });
  }

  // Additional method for simple team list (for dropdowns)
  async getTeamsSimple(): Promise<Array<{id: string, name: string, member_count: number}>> {
    if (this.useAPI) {
      try {
        const response = await api.get(`${this.baseUrl}/simple`);
        
        if (response.data.success && response.data.data) {
          return response.data.data.map((team: any) => ({
            id: team.id,
            name: team.name,
            member_count: team.member_count
          }));
        }
        
        throw new Error('Failed to fetch teams list');
      } catch (error: any) {
        console.warn('API not available, falling back to dummy data:', error.message);
        this.useAPI = false;
      }
    }
    
    // Fallback to dummy data
    return Promise.resolve(
      DUMMY_TEAMS.map(team => ({
        id: team._id,
        name: team.name,
        member_count: team.userCount
      }))
    );
  }

  // Method to enable/disable API usage
  setAPIMode(enabled: boolean) {
    this.useAPI = enabled;
  }

  // Method to test API connection
  async testAPIConnection(): Promise<boolean> {
    const available = await this.checkAPIAvailability();
    this.useAPI = available;
    return available;
  }
}

export default new TeamService();