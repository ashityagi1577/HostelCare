const UserModel = require('../models/user.model');
const { hashPassword, comparePassword } = require('../utils/password.util');
const { generateToken } = require('../utils/jwt.util');

/**
 * Register a student account for an authenticated administrator.
 * POST /api/auth/register
 */
async function register(req, res) {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can provision accounts.'
      });
    }

    const { user_id, student_id, name, email, password, hostel_block, room_no, phone } = req.body;
    const requestedId = (user_id || student_id || '').trim();

    // 1. Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, and password are required fields.'
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid email address.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long.'
      });
    }

    // 2. Check if email already exists
    const emailTaken = await UserModel.emailExists(email);
    if (emailTaken) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email address already exists.'
      });
    }

    // Check if requested user_id is already taken
    if (requestedId) {
      const idTaken = await UserModel.userIdExists(requestedId);
      if (idTaken) {
        return res.status(409).json({
          success: false,
          error: `The Student ID '${requestedId}' is already registered in the system.`
        });
      }
    }

    // 3. Hash password & create user record
    const passwordHash = await hashPassword(password);
    const newUser = await UserModel.createUser({
      user_id: requestedId || null,
      name,
      email,
      passwordHash,
      role: 'student', // Public self-registration always assigns student role
      hostel_block: hostel_block || null,
      room_no: room_no || null,
      phone: phone || null
    });

    // 4. Generate JWT token (role embedded securely)
    const token = generateToken(newUser);

    return res.status(201).json({
      success: true,
      message: `Registration successful! Your unique Student ID is ${newUser.user_id}.`,
      data: {
        user: newUser,
        token
      }
    });
  } catch (error) {
    console.error('[Register Controller Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred while creating your account.'
    });
  }
}

/**
 * Universal Authentication for all users (Students, Staff, Wardens, Admins).
 * Identifies role automatically from the database record.
 * POST /api/auth/login
 * Body: { identifier (or email), password }
 */
async function login(req, res) {
  try {
    const identifier = (req.body.identifier || req.body.email || req.body.user_id || req.body.username || '').trim();
    const password = req.body.password;

    // 1. Validation
    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email / User ID and password are required.'
      });
    }

    // 2. Lookup user by either Email OR User ID / Student ID / Staff ID
    const user = await UserModel.findByIdentifier(identifier);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials. User ID / Email or password incorrect.'
      });
    }

    // 3. Verify password hash using Bcrypt
    const isPasswordValid = await comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials. User ID / Email or password incorrect.'
      });
    }

    // 4. Generate signed JWT token with role locked from database record
    const token = generateToken(user);

    // Exclude password hash from response
    const { password_hash, ...safeUserProfile } = user;

    return res.status(200).json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      data: {
        user: safeUserProfile,
        token
      }
    });
  } catch (error) {
    console.error('[Login Controller Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred during login.'
    });
  }
}

/**
 * Retrieve authenticated user profile.
 * GET /api/auth/me
 */
async function getProfile(req, res) {
  try {
    const user = await UserModel.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User profile not found.'
      });
    }

    return res.status(200).json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('[GetProfile Controller Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve user profile.'
    });
  }
}

module.exports = {
  register,
  login,
  getProfile
};
