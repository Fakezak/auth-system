const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Basic Info
  username: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  displayName: String,
  
  // Auth Type
  authType: {
    type: String,
    enum: ['discord', 'facebook', 'google', 'normal'],
    required: true
  },
  
  // Discord specific
  discordId: String,
  discordUsername: String,
  discordAvatar: String,
  discordEmail: String,
  joinedDiscord: {
    type: Boolean,
    default: false
  },
  discordJoinDate: Date,
  
  // Facebook specific
  facebookId: String,
  facebookUsername: String,
  facebookEmail: String,
  
  // Google specific
  googleId: String,
  googleUsername: String,
  googleEmail: String,
  
  // Normal auth
  password: {
    type: String,
    select: false
  },
  
  // Game specific
  gameId: String,
  gameUsername: String,
  gameLevel: {
    type: Number,
    default: 1
  },
  gamePlayTime: {
    type: Number,
    default: 0
  },
  gameWins: {
    type: Number,
    default: 0
  },
  gameStats: {
    kills: { type: Number, default: 0 },
    deaths: { type: Number, default: 0 },
    headshots: { type: Number, default: 0 },
    matchesPlayed: { type: Number, default: 0 }
  },
  
  // Role & Permissions
  role: {
    type: String,
    enum: ['user', 'mod', 'admin', 'vip'],
    default: 'user'
  },
  permissions: [String],
  
  // Account status
  isVerified: {
    type: Boolean,
    default: false
  },
  isBanned: {
    type: Boolean,
    default: false
  },
  banReason: String,
  
  // Meta
  lastLogin: Date,
  loginCount: {
    type: Number,
    default: 0
  },
  ipAddresses: [String],
  devices: [String],
  
  // Game config paths
  gameConfigPath: String,
  localConfigPath: String,
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || this.authType !== 'normal') {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// Update timestamps
userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('User', userSchema);
