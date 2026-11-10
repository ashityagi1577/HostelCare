const UserModel = require('../models/user.model');
const { hashPassword, comparePassword } = require('../utils/password.util');
const { generateToken } = require('../utils/jwt.util');

/**
 * Register a new hostel student resident.
 * POST /api/auth/register
 */
async function register(req, res) {
  try {
    const { name, email, password, hostel_block, room_no, phone } = req.body;

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

    // 2. Check if user already exists
    const existing = await UserModel.emailExists(email);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email address already exists.'
      });
    }

    // 3. Hash password & create user record
    const passwordHash = await hashPassword(password);
    const newUser = await UserModel.createUser({
      name,
      email,
      passwordHash,
      role: 'student', // Public registration defaults to student
      hostel_block: hostel_block || null,
      room_no: room_no || null,
      phone: phone || null
    });

    // 4. Generate JWT token
    const token = generateToken(newUser);

    return res.status(201).json({
      success: true,
      message: 'Student registration successful. Welcome to HostelCare!',
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
 * Authenticate student or staff with email and password.
 * POST /api/auth/login
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    // 1. Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required.'
      });
    }

    // 2. Lookup user by email
    const user = await UserModel.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.'
      });
    }

    // 3. Verify password hash
    const isPasswordValid = await comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.'
      });
    }

    // 4. Generate JWT token
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

