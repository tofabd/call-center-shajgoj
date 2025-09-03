// Team-related TypeScript interfaces

export interface Team {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  metadata?: Record<string, any>;
  userCount?: number;
  users?: Array<{
    _id: string;
    name: string;
    email: string;
    teamId?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface TeamStats {
  total_teams: number;
  active_teams: number;
  inactive_teams: number;
  teams_with_users: number;
  empty_teams: number;
}

export interface CreateTeamData {
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateTeamData {
  name?: string;
  description?: string;
  isActive?: boolean;
}