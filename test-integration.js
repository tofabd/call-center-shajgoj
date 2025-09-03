const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}));
app.use(express.json());

// In-memory storage for testing
let teams = [
  {
    _id: '1',
    name: 'Sales Team',
    description: 'Handles all sales activities',
    department: 'Sales',
    manager_name: 'John Doe',
    manager_email: 'john@example.com',
    max_members: 10,
    is_active: true,
    member_count: 3,
    created_by: 'system',
    updated_by: 'system',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    _id: '2',
    name: 'Support Team',
    description: 'Customer support and technical assistance',
    department: 'Support',
    manager_name: 'Jane Smith',
    manager_email: 'jane@example.com',
    max_members: 8,
    is_active: true,
    member_count: 5,
    created_by: 'system',
    updated_by: 'system',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: 'Test Mode',
    uptime: process.uptime()
  });
});

// Teams endpoints
app.get('/api/teams', (req, res) => {
  console.log('GET /api/teams called');
  res.json({
    success: true,
    data: teams,
    pagination: {
      currentPage: 1,
      totalPages: 1,
      totalTeams: teams.length,
      hasNextPage: false,
      hasPrevPage: false,
      limit: 50
    }
  });
});

app.get('/api/teams/statistics', (req, res) => {
  console.log('GET /api/teams/statistics called');
  const activeTeams = teams.filter(t => t.is_active).length;
  const totalMembers = teams.reduce((sum, t) => sum + (t.member_count || 0), 0);
  
  res.json({
    success: true,
    data: {
      summary: {
        total_teams: teams.length,
        active_teams: activeTeams,
        inactive_teams: teams.length - activeTeams,
        total_members: totalMembers,
        avg_team_size: teams.length > 0 ? Math.round(totalMembers / teams.length) : 0,
        capacity_warnings: 0
      },
      by_department: {
        Sales: 1,
        Support: 1
      },
      team_sizes: teams.map(team => ({
        team_id: team._id,
        name: team.name,
        department: team.department,
        member_count: team.member_count,
        max_members: team.max_members,
        utilization: team.max_members ? 
          Math.round((team.member_count / team.max_members) * 100) : null
      }))
    }
  });
});

app.get('/api/teams/:id', (req, res) => {
  console.log('GET /api/teams/:id called with id:', req.params.id);
  const team = teams.find(t => t._id === req.params.id);
  if (!team) {
    return res.status(404).json({
      success: false,
      message: 'Team not found'
    });
  }
  
  res.json({
    success: true,
    data: {
      ...team,
      members: [] // No members in test data
    }
  });
});

app.post('/api/teams', (req, res) => {
  console.log('POST /api/teams called with data:', req.body);
  const { name, description, department, manager_name, manager_email, max_members, is_active } = req.body;
  
  if (!name) {
    return res.status(400).json({
      success: false,
      message: 'Team name is required'
    });
  }
  
  // Check for duplicate name
  const existingTeam = teams.find(t => t.name.toLowerCase() === name.toLowerCase());
  if (existingTeam) {
    return res.status(409).json({
      success: false,
      message: 'Team name already exists'
    });
  }
  
  const newTeam = {
    _id: Date.now().toString(),
    name,
    description: description || '',
    department: department || '',
    manager_name: manager_name || '',
    manager_email: manager_email || '',
    max_members: max_members || null,
    is_active: is_active !== undefined ? is_active : true,
    member_count: 0,
    created_by: 'frontend_user',
    updated_by: 'frontend_user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  teams.push(newTeam);
  
  res.status(201).json({
    success: true,
    message: 'Team created successfully',
    data: newTeam
  });
});

app.put('/api/teams/:id', (req, res) => {
  console.log('PUT /api/teams/:id called with id:', req.params.id, 'data:', req.body);
  const teamIndex = teams.findIndex(t => t._id === req.params.id);
  if (teamIndex === -1) {
    return res.status(404).json({
      success: false,
      message: 'Team not found'
    });
  }
  
  const { name, description, department, manager_name, manager_email, max_members, is_active } = req.body;
  
  // Check for duplicate name (excluding current team)
  if (name) {
    const existingTeam = teams.find(t => t._id !== req.params.id && t.name.toLowerCase() === name.toLowerCase());
    if (existingTeam) {
      return res.status(409).json({
        success: false,
        message: 'Team name already exists'
      });
    }
  }
  
  const updatedTeam = {
    ...teams[teamIndex],
    ...(name !== undefined && { name }),
    ...(description !== undefined && { description }),
    ...(department !== undefined && { department }),
    ...(manager_name !== undefined && { manager_name }),
    ...(manager_email !== undefined && { manager_email }),
    ...(max_members !== undefined && { max_members }),
    ...(is_active !== undefined && { is_active }),
    updated_by: 'frontend_user',
    updatedAt: new Date().toISOString()
  };
  
  teams[teamIndex] = updatedTeam;
  
  res.json({
    success: true,
    message: 'Team updated successfully',
    data: updatedTeam
  });
});

app.delete('/api/teams/:id', (req, res) => {
  console.log('DELETE /api/teams/:id called with id:', req.params.id);
  const teamIndex = teams.findIndex(t => t._id === req.params.id);
  if (teamIndex === -1) {
    return res.status(404).json({
      success: false,
      message: 'Team not found'
    });
  }
  
  const team = teams[teamIndex];
  if (team.member_count > 0 && req.query.force !== 'true') {
    return res.status(400).json({
      success: false,
      message: `Cannot delete team with ${team.member_count} member(s). Use force=true to delete anyway.`,
      data: { member_count: team.member_count }
    });
  }
  
  teams.splice(teamIndex, 1);
  
  res.json({
    success: true,
    message: 'Team deleted successfully',
    data: {
      deleted_team: team.name,
      members_affected: 0
    }
  });
});

app.get('/api/teams/simple', (req, res) => {
  console.log('GET /api/teams/simple called');
  const simpleTeams = teams
    .filter(t => req.query.is_active !== 'false' ? t.is_active : true)
    .map(team => ({
      id: team._id,
      name: team.name,
      department: team.department,
      member_count: team.member_count
    }));
  
  res.json({
    success: true,
    data: simpleTeams
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Test API Server running on http://localhost:${PORT}`);
  console.log(`📋 Health: http://localhost:${PORT}/health`);
  console.log(`👥 Teams: http://localhost:${PORT}/api/teams`);
});