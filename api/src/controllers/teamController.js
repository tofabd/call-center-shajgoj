import Team from '../models/Team.js';
import User from '../models/User.js';

// Get all teams with pagination and filtering
export const getTeams = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      department,
      is_active,
      sort_by = 'createdAt',
      sort_order = 'desc'
    } = req.query;

    // Build filter query
    const filter = {};
    
    if (is_active !== undefined) {
      filter.is_active = is_active === 'true';
    }
    
    if (department) {
      filter.department = { $regex: department, $options: 'i' };
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } },
        { manager_name: { $regex: search, $options: 'i' } }
      ];
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOrder = sort_order === 'asc' ? 1 : -1;
    const sortField = sort_by || 'createdAt';

    const teams = await Team.find(filter)
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get member counts for each team
    const teamsWithMemberCount = await Promise.all(
      teams.map(async (team) => {
        const memberCount = await User.countDocuments({ team_id: team._id });
        return {
          ...team,
          member_count: memberCount
        };
      })
    );

    const total = await Team.countDocuments(filter);
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: teamsWithMemberCount,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalTeams: total,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching teams',
      error: error.message
    });
  }
};

// Get team by ID
export const getTeamById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Get team members
    const members = await User.find({ team_id: id })
      .select('name email extension role department is_active')
      .sort({ name: 1 });

    const teamWithMembers = {
      ...team.toJSON(),
      members: members,
      member_count: members.length
    };

    res.json({
      success: true,
      data: teamWithMembers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching team',
      error: error.message
    });
  }
};

// Create new team
export const createTeam = async (req, res) => {
  try {
    const {
      name,
      description,
      department,
      manager_name,
      manager_email,
      max_members,
      is_active = true,
      created_by = 'system'
    } = req.body;

    // Validation
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Team name is required'
      });
    }

    if (name.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Team name cannot exceed 100 characters'
      });
    }

    if (description && description.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Description cannot exceed 500 characters'
      });
    }

    if (manager_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(manager_email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid manager email format'
      });
    }

    if (max_members && (max_members < 1 || max_members > 1000)) {
      return res.status(400).json({
        success: false,
        message: 'Max members must be between 1 and 1000'
      });
    }

    const teamData = {
      name: name.trim(),
      description: description?.trim() || '',
      department: department?.trim() || '',
      manager_name: manager_name?.trim() || '',
      manager_email: manager_email?.trim().toLowerCase() || '',
      max_members,
      is_active,
      created_by,
      updated_by: created_by
    };

    const team = new Team(teamData);
    const savedTeam = await team.save();

    res.status(201).json({
      success: true,
      message: 'Team created successfully',
      data: savedTeam
    });
  } catch (error) {
    if (error.code === 'DUPLICATE_TEAM_NAME' || error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Team name already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating team',
      error: error.message
    });
  }
};

// Update team
export const updateTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      department,
      manager_name,
      manager_email,
      max_members,
      is_active,
      updated_by = 'system'
    } = req.body;

    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Validation
    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Team name is required'
        });
      }

      if (name.length > 100) {
        return res.status(400).json({
          success: false,
          message: 'Team name cannot exceed 100 characters'
        });
      }
    }

    if (description !== undefined && description.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Description cannot exceed 500 characters'
      });
    }

    if (manager_email !== undefined && manager_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(manager_email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid manager email format'
      });
    }

    if (max_members !== undefined && max_members && (max_members < 1 || max_members > 1000)) {
      return res.status(400).json({
        success: false,
        message: 'Max members must be between 1 and 1000'
      });
    }

    // Build update object
    const updateData = { updated_by };
    
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (department !== undefined) updateData.department = department.trim();
    if (manager_name !== undefined) updateData.manager_name = manager_name.trim();
    if (manager_email !== undefined) updateData.manager_email = manager_email.trim().toLowerCase();
    if (max_members !== undefined) updateData.max_members = max_members;
    if (is_active !== undefined) updateData.is_active = is_active;

    const updatedTeam = await Team.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Team updated successfully',
      data: updatedTeam
    });
  } catch (error) {
    if (error.code === 'DUPLICATE_TEAM_NAME' || error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Team name already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating team',
      error: error.message
    });
  }
};

// Delete team
export const deleteTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const { force = false } = req.query;

    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if team has members
    const memberCount = await User.countDocuments({ team_id: id });
    
    if (memberCount > 0 && !force) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete team with ${memberCount} member(s). Use force=true to delete anyway.`,
        data: { member_count: memberCount }
      });
    }

    // If force delete, remove team_id from all users
    if (force && memberCount > 0) {
      await User.updateMany(
        { team_id: id },
        { $unset: { team_id: 1 } }
      );
    }

    await Team.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Team deleted successfully',
      data: {
        deleted_team: team.name,
        members_affected: force ? memberCount : 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting team',
      error: error.message
    });
  }
};

// Get team statistics
export const getTeamStatistics = async (req, res) => {
  try {
    // Basic team statistics
    const [
      totalTeams,
      activeTeams,
      teamsByDepartment,
      totalMembers
    ] = await Promise.all([
      Team.countDocuments(),
      Team.countDocuments({ is_active: true }),
      Team.aggregate([
        { $match: { is_active: true } },
        { $group: { _id: '$department', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      User.countDocuments({ team_id: { $exists: true, $ne: null } })
    ]);

    // Team size distribution
    const teamSizes = await Team.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: 'team_id',
          as: 'members'
        }
      },
      {
        $project: {
          name: 1,
          department: 1,
          member_count: { $size: '$members' },
          max_members: 1,
          is_active: 1
        }
      },
      { $match: { is_active: true } }
    ]);

    // Calculate averages
    const avgTeamSize = teamSizes.length > 0 ? 
      Math.round(teamSizes.reduce((sum, team) => sum + team.member_count, 0) / teamSizes.length) : 0;

    // Department statistics
    const departmentStats = {};
    teamsByDepartment.forEach(dept => {
      departmentStats[dept._id || 'No Department'] = dept.count;
    });

    // Teams with capacity issues (over 80% full)
    const capacityWarnings = teamSizes.filter(team => {
      return team.max_members && (team.member_count / team.max_members) > 0.8;
    }).length;

    res.json({
      success: true,
      data: {
        summary: {
          total_teams: totalTeams,
          active_teams: activeTeams,
          inactive_teams: totalTeams - activeTeams,
          total_members: totalMembers,
          avg_team_size: avgTeamSize,
          capacity_warnings: capacityWarnings
        },
        by_department: departmentStats,
        team_sizes: teamSizes.map(team => ({
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
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching team statistics',
      error: error.message
    });
  }
};

// Get teams for dropdown/selection (simplified response)
export const getTeamsSimple = async (req, res) => {
  try {
    const { is_active = true } = req.query;
    
    const filter = {};
    if (is_active !== undefined) {
      filter.is_active = is_active === 'true';
    }

    const teams = await Team.find(filter)
      .select('name department member_count')
      .sort({ name: 1 })
      .lean();

    // Add member counts
    const teamsWithCount = await Promise.all(
      teams.map(async (team) => {
        const memberCount = await User.countDocuments({ team_id: team._id });
        return {
          id: team._id,
          name: team.name,
          department: team.department,
          member_count: memberCount
        };
      })
    );

    res.json({
      success: true,
      data: teamsWithCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching teams',
      error: error.message
    });
  }
};