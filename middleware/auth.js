const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  
  // Check for JWT token
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      return next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }
  
  res.status(401).json({ error: 'Authentication required' });
};

// Check if user has mod permissions
const isMod = (req, res, next) => {
  if (!req.user || (req.user.role !== 'mod' && req.user.role !== 'admin')) {
    return res.status(403).json({ error: 'Mod permissions required' });
  }
  next();
};

// Check if user is admin
const isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin permissions required' });
  }
  next();
};

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user._id, 
      username: user.username,
      email: user.email,
      role: user.role 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRATION || '7d' }
  );
};

module.exports = {
  isAuthenticated,
  isMod,
  isAdmin,
  generateToken
};
