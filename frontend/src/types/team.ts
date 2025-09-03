// Team-related TypeScript interfaces

export interface Team {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  users_count?: number;
  created_at: string;
  updated_at: string;
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
  description?: string | null;
  is_active?: boolean;
}

export interface UpdateTeamData {
  name?: string;
  description?: string | null;
  is_active?: boolean;
}