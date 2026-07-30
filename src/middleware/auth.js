const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-123456');

    const user = await User.findById(decoded.id).populate('role').populate('branch').populate('branches');
    if (!user) {
      return res.status(401).json({ message: 'Authentication failed. User not found.' });
    }

    if (user.status === 'Inactive' || user.status === 'Suspended' || user.isLocked) {
      return res.status(403).json({ message: 'Access denied. Your account is locked. Please contact the Super Admin.' });
    }

    req.user = user;

    const headerBranch = req.headers['x-selected-branch'];
    let activeBranchObj = null;

    if (headerBranch && headerBranch !== 'All') {
      const allUserBranches = [
        user.branch,
        ...(Array.isArray(user.branches) ? user.branches : [])
      ].filter(Boolean);
      
      activeBranchObj = allUserBranches.find(b => 
        (b._id && b._id.toString() === headerBranch) || 
        (b.name && b.name === headerBranch)
      );
    }

    if (!activeBranchObj) {
      activeBranchObj = user.branch || (user.branches && user.branches[0]) || null;
    }

    req.activeBranch = activeBranchObj;

    const activeBranchName = activeBranchObj && activeBranchObj.name ? activeBranchObj.name : '';
    req.isHomeServiceBranch = activeBranchName.toLowerCase().includes('home service');
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    return res.status(401).json({ message: 'Invalid token' });
  }
};

const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ message: 'Access denied. No role profile found.' });
    }

    // Super Admin has all privileges implicitly
    if (req.user.role.name === 'Super Admin') {
      return next();
    }

    const permissionsToCheck = Array.isArray(permission) ? permission : [permission];
    let hasPermission = permissionsToCheck.some(p => req.user.role.permissions.includes(p));

    // Support Counter Staff managing/scheduling deliveries and pickups
    if (!hasPermission && req.user.role.name === 'Counter Staff') {
      const allowedCounterPermissions = ['manage_deliveries', 'manage_pickups', 'view_deliveries', 'view_pickups'];
      hasPermission = permissionsToCheck.some(p => allowedCounterPermissions.includes(p));
    }

    // Support Delivery Staff / Drivers accessing customer, invoice, payment and order modules
    if (!hasPermission && (req.user.role.name === 'Delivery Staff' || req.user.role.name === 'Driver')) {
      const allowedDeliveryPermissions = [
        'create_orders', 'view_orders', 'manage_orders', 
        'manage_customers', 'manage_payments', 'view_invoice_status', 
        'change_invoice_status', 'view_logistics'
      ];
      hasPermission = permissionsToCheck.some(p => allowedDeliveryPermissions.includes(p));
    }

    if (!hasPermission) {
      return res.status(403).json({ message: `Access denied. Requires '${permissionsToCheck.join("' or '")}' permission.` });
    }

    next();
  };
};

module.exports = {
  authenticate,
  requirePermission
};
