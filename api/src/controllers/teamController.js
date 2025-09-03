import Team from '../models/Team.js';
import User from '../models/User.js';

// Get all teams with pagination and filtering
export const getTeams = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      is_active,
      sort_by = 'createdAt',
      sort_order = 'desc'
    } = req.query;

    // Build filter query
    const filter = {};
    
    if (is_active !== undefined) {
      filter.is_active = is_active === 'true';
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } }
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
        const users_count = await User.countDocuments({ team_id: team._id });
        return {
          id: team._id,
          name: team.name,
          slug: team.slug,
          description: team.description,
          is_active: team.is_active,
          users_count,
          created_at: team.createdAt,
          updated_at: team.updatedAt
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
      .select('name email extension is_active')
      .sort({ name: 1 });

    const users_count = await User.countDocuments({ team_id: id });

    const teamData = {
      id: team._id,
      name: team.name,
      slug: team.slug,
      description: team.description,
      is_active: team.is_active,
      users_count,
      members,
      created_at: team.createdAt,
      updated_at: team.updatedAt
    };

    res.json({
      success: true,
      data: teamData
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
      is_active = true
    } = req.body;

    // Validation
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Team name is required'
      });
    }

    if (name.length > 255) {
      return res.status(400).json({
        success: false,
        message: 'Team name cannot exceed 255 characters'
      });
    }

    if (description && description.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Description cannot exceed 1000 characters'
      });
    }

    const teamData = {
      name: name.trim(),
      description: description?.trim() || null,
      is_active,
      slug: '' // Add empty slug to trigger pre-save middleware slug generation
    };

    const team = new Team(teamData);
    const savedTeam = await team.save();

    const responseData = {
      id: savedTeam._id,
      name: savedTeam.name,
      slug: savedTeam.slug,
      description: savedTeam.description,
      is_active: savedTeam.is_active,
      users_count: 0,
      created_at: savedTeam.createdAt,
      updated_at: savedTeam.updatedAt
    };

    res.status(201).json({
      success: true,
      message: 'Team created successfully',
      data: responseData
    });
  } catch (error) {
    if (error.code === 11000) {
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
      is_active
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

      if (name.length > 255) {
        return res.status(400).json({
          success: false,
          message: 'Team name cannot exceed 255 characters'
        });
      }
    }

    if (description !== undefined && description && description.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Description cannot exceed 1000 characters'
      });
    }

    // Build update object
    const updateData = {};
    
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (is_active !== undefined) updateData.is_active = is_active;

    const updatedTeam = await Team.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    const users_count = await User.countDocuments({ team_id: id });

    const responseData = {
      id: updatedTeam._id,
      name: updatedTeam.name,
      slug: updatedTeam.slug,
      description: updatedTeam.description,
      is_active: updatedTeam.is_active,
      users_count,
      created_at: updatedTeam.createdAt,
      updated_at: updatedTeam.updatedAt
    };

    res.json({
      success: true,
      message: 'Team updated successfully',
      data: responseData
    });
  } catch (error) {
    if (error.code === 11000) {
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

    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if team has members
    const memberCount = await User.countDocuments({ team_id: id });
    
    if (memberCount > 0) {
      return res.status(422).json({
        success: false,
        message: `Cannot delete team with ${memberCount} member(s). Please reassign them first.`
      });
    }

    await Team.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Team deleted successfully'
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
    const [
      totalTeams,
      activeTeams,
      totalMembers,
      emptyTeams
    ] = await Promise.all([
      Team.countDocuments(),
      Team.countDocuments({ is_active: true }),
      User.countDocuments({ team_id: { $exists: true, $ne: null } }),
      Team.countDocuments({
        _id: { $nin: await User.distinct('team_id', { team_id: { $exists: true, $ne: null } }) }
      })
    ]);

    const teamsWithUsers = await Team.aggregate([
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
          member_count: { $size: '$members' }
        }
      },
      {
        $match: { member_count: { $gt: 0 } }
      },
      {
        $count: 'count'
      }
    ]);

    const teamsWithUsersCount = teamsWithUsers.length > 0 ? teamsWithUsers[0].count : 0;

    res.json({
      success: true,
      data: {
        summary: {
          total_teams: totalTeams,
          active_teams: activeTeams,
          inactive_teams: totalTeams - activeTeams,
          teams_with_users: teamsWithUsersCount,
          empty_teams: totalTeams - teamsWithUsersCount
        }
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
      .select('name')
      .sort({ name: 1 })
      .lean();

    // Add member counts
    const teamsWithCount = await Promise.all(
      teams.map(async (team) => {
        const member_count = await User.countDocuments({ team_id: team._id });
        return {
          id: team._id,
          name: team.name,
          member_count
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