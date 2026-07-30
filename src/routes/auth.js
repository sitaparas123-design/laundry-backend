const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const Branch = require('../models/Branch');
const RefreshToken = require('../models/RefreshToken');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-123456';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret-key-123456';

// Helper to generate tokens
const generateAccessToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '15m' });
};

const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
};

// @route   POST /api/auth/login
// @desc    Authenticate user and get token
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const selectedBranch = req.body.branchId ? req.body.branchId.toString() : '';

    // Find user matching email or username
    const user = await User.findOne({
      $or: [{ email }, { username: email }]
    }).populate('role').populate('branch').populate('branches');

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check account status
    if (user.status === 'Inactive' || user.status === 'Suspended' || user.isLocked) {
      return res.status(403).json({
        message: 'Access denied. Your account is locked. Please contact the Super Admin.'
      });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const userBranchIds = (user.branches && user.branches.length > 0)
      ? user.branches.map(b => b._id.toString())
      : (user.branch ? [user.branch._id.toString()] : []);

    const userBranchNames = (user.branches && user.branches.length > 0)
      ? user.branches.map(b => b.name)
      : (user.branch ? [user.branch.name] : []);

    const isSuperAdmin = user.role && user.role.name === 'Super Admin';

    // Enforce strict branch validation for non-Super Admin users
    if (!isSuperAdmin) {
      if (!selectedBranch) {
        return res.status(400).json({ message: 'Access Denied: You are not assigned to the selected branch.' });
      }

      const isAssigned = userBranchIds.includes(selectedBranch) || userBranchNames.includes(selectedBranch);

      if (!isAssigned) {
        return res.status(400).json({ message: 'Access Denied: You are not assigned to the selected branch.' });
      }
    }

    // Determine active branch for login session
    let activeBranchId = '';
    let activeBranchName = '';

    if (isSuperAdmin) {
      activeBranchId = selectedBranch || 'All';
      if (selectedBranch) {
        const foundB = (user.branches || []).find(b => b._id.toString() === selectedBranch || b.name === selectedBranch);
        activeBranchName = foundB ? foundB.name : selectedBranch;
      } else {
        activeBranchName = user.branch ? user.branch.name : 'All';
      }
    } else {
      let idx = userBranchIds.indexOf(selectedBranch);
      if (idx === -1) {
        idx = userBranchNames.indexOf(selectedBranch);
      }

      if (idx !== -1) {
        activeBranchId = userBranchIds[idx] || selectedBranch;
        activeBranchName = userBranchNames[idx] || selectedBranch;
      } else {
        activeBranchId = userBranchIds[0] || (user.branch ? user.branch._id.toString() : selectedBranch);
        activeBranchName = userBranchNames[0] || (user.branch ? user.branch.name : selectedBranch);
      }
    }

    // Generate tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Save refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await RefreshToken.create({
      user: user._id,
      token: refreshToken,
      expiresAt
    });

    // Send response formatted matching frontend expectations
    res.json({
      token: accessToken,
      refreshToken: refreshToken,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role ? user.role.name : '',
        branchId: activeBranchId || (userBranchIds[0] || null),
        branchName: activeBranchName || (userBranchNames[0] || null),
        branchIds: userBranchIds,
        branches: userBranchNames
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   POST /api/auth/refresh
// @desc    Refresh access token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }

    const tokenDoc = await RefreshToken.findOne({ token: refreshToken });
    if (!tokenDoc) {
      return res.status(403).json({ message: 'Invalid refresh token' });
    }

    // Verify token
    try {
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);

      const newAccessToken = generateAccessToken(decoded.id);
      const newRefreshToken = generateRefreshToken(decoded.id);

      // Rotate token: delete old, save new
      await RefreshToken.deleteOne({ _id: tokenDoc._id });

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      await RefreshToken.create({
        user: decoded.id,
        token: newRefreshToken,
        expiresAt
      });

      res.json({
        token: newAccessToken,
        refreshToken: newRefreshToken
      });
    } catch (err) {
      await RefreshToken.deleteOne({ _id: tokenDoc._id });
      return res.status(403).json({ message: 'Session expired. Please log in again.' });
    }

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   POST /api/auth/logout
// @desc    Invalidate refresh token
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await RefreshToken.deleteOne({ token: refreshToken });
    }
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   POST /api/auth/change-password
// @desc    Change logged-in user password
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Both current and new passwords are required.' });
    }

    const user = await User.findById(req.user._id);
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect.' });
    }

    user.passwordHash = newPassword; // Pre-save hook will hash it automatically since it gets modified
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
