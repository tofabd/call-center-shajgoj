// Team-related TypeScript interfaces

export interface TeamExtension {
  id: string;
  extension: string;
  agent_name?: string;
  availability_status: 'online' | 'offline' | 'unknown' | 'invalid';
  is_active: boolean;
}

export interface Team {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  extensions_count: number;
  online_extensions_count: number;
  extensions: TeamExtension[];
}

export interface TeamStats {
  total_teams: number;
  active_teams: number;
  inactive_teams: number;
  teams_with_extensions: number;
  teams_without_extensions: number;
}

export interface TopTeam {
  name: string;
  extensions_count: number;
  color: string;
}

export interface TeamStatsResponse {
  stats: TeamStats;
  top_teams: TopTeam[];
}

export interface CreateTeamData {
  name: string;
  description?: string | null;
  color?: string;
  is_active?: boolean;
}

export interface UpdateTeamData {
  name?: string;
  description?: string | null;
  color?: string;
  is_active?: boolean;
}