const User = require('../models/User');
const jwt = require('jsonwebtoken');
const fs = require('fs-extra');
const path = require('path');
const config = require('../config/localconfig.json');

// Generate JWT
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user._id, 
      username: user.username,
      email: user.email,
      role: user.role,
      gameId: user.gameId
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRATION }
  );
};

// Create or update user after authentication
const handleAuthSuccess = async (profile, authType, done) => {
  try {
    // Find existing user
    let user = await User.findOne({ 
      $or: [
        { email: profile.email },
        { [`${authType}Id`]: profile.id }
      ]
    });

    const now = new Date();
    const configPath = path.join(process.cwd(), 'com.dts.freefireth', 'files');

    if (user) {
      // Update existing user
      user.lastLogin = now;
      user.loginCount += 1;
      
      // Update auth-specific fields
      updateAuthFields(user, profile, authType);
      
      // Update game data if needed
      await updateGameData(user);
      
      await user.save();
      
      // Check if user needs to join Discord
      if (config.auth.requireDiscordJoin && !user.joinedDiscord) {
        return done(null, user, { 
          requiresDiscord: true,
          discordLink: 'https://discord.gg/k6R6CKw7Q'
        });
      }
      
      return done(null, user);
    }

    // Create new user
    const newUser = new User({
      username: profile.username || profile.displayName || profile.email.split('@')[0],
      email: profile.email,
      displayName: profile.displayName || profile.username,
      authType: authType,
      isVerified: true,
      loginCount: 1,
      lastLogin: now,
      gameId: generateGameId(),
      gameLevel: 1,
      gamePlayTime: 0,
      gameWins: 0,
      joinedDiscord: false
    });

    // Set auth-specific fields
    setAuthFields(newUser, profile, authType);

    // Set game config path
    newUser.gameConfigPath = path.join(configPath, `user_${newUser.gameId}.json`);
    newUser.localConfigPath = path.join(configPath, 'localconfig.json');

    await newUser.save();

    // Create game files for user
    await createGameFiles(newUser);

    // Auto-promote to mod if conditions met
    if (config.modScripts.autoMod) {
      await checkAndPromoteToMod(newUser);
    }

    // Require Discord join for new users
    if (config.auth.requireDiscordJoin) {
      return done(null, newUser, { 
        requiresDiscord: true,
        discordLink: 'https://discord.gg/k6R6CKw7Q'
      });
    }

    return done(null, newUser);
  } catch (error) {
    console.error('Auth success handler error:', error);
    return done(error, null);
  }
};

// Update auth-specific fields
const updateAuthFields = (user, profile, authType) => {
  switch(authType) {
    case 'discord':
      user.discordId = profile.id;
      user.discordUsername = profile.username;
      user.discordAvatar = profile.avatar;
      user.discordEmail = profile.email;
      break;
    case 'facebook':
      user.facebookId = profile.id;
      user.facebookUsername = profile.username;
      user.facebookEmail = profile.email;
      break;
    case 'google':
      user.googleId = profile.id;
      user.googleUsername = profile.username;
      user.googleEmail = profile.email;
      break;
  }
};

// Set auth-specific fields for new user
const setAuthFields = (user, profile, authType) => {
  switch(authType) {
    case 'discord':
      user.discordId = profile.id;
      user.discordUsername = profile.username;
      user.discordAvatar = profile.avatar;
      user.discordEmail = profile.email;
      break;
    case 'facebook':
      user.facebookId = profile.id;
      user.facebookUsername = profile.username;
      user.facebookEmail = profile.email;
      break;
    case 'google':
      user.googleId = profile.id;
      user.googleUsername = profile.username;
      user.googleEmail = profile.email;
      break;
  }
};

// Generate unique game ID
const generateGameId = () => {
  return 'FF' + Date.now().toString(36).toUpperCase() + 
         Math.random().toString(36).substring(2, 6).toUpperCase();
};

// Create game files for user
const createGameFiles = async (user) => {
  try {
    const gameDir = path.join(process.cwd(), 'com.dts.freefireth', 'files');
    await fs.ensureDir(gameDir);
    
    const userConfig = {
      userId: user._id.toString(),
      gameId: user.gameId,
      username: user.username,
      displayName: user.displayName,
      level: user.gameLevel,
      stats: user.gameStats,
      authType: user.authType,
      joinedDiscord: user.joinedDiscord,
      lastLogin: user.lastLogin,
      permissions: user.permissions,
      role: user.role
    };
    
    await fs.writeJson(
      path.join(gameDir, `user_${user.gameId}.json`),
      userConfig,
      { spaces: 2 }
    );
    
    // Copy localconfig.json to game files
    await fs.copy(
      path.join(process.cwd(), 'config', 'localconfig.json'),
      path.join(gameDir, 'localconfig.json')
    );
    
    console.log(`✅ Game files created for user: ${user.username}`);
  } catch (error) {
    console.error('Error creating game files:', error);
  }
};

// Update game data
const updateGameData = async (user) => {
  try {
    const gameDir = path.join(process.cwd(), 'com.dts.freefireth', 'files');
    const userConfigPath = path.join(gameDir, `user_${user.gameId}.json`);
    
    if (await fs.pathExists(userConfigPath)) {
      const userConfig = await fs.readJson(userConfigPath);
      userConfig.lastLogin = user.lastLogin;
      userConfig.level = user.gameLevel;
      userConfig.stats = user.gameStats;
      await fs.writeJson(userConfigPath, userConfig, { spaces: 2 });
    }
  } catch (error) {
    console.error('Error updating game data:', error);
  }
};

// Check and promote to mod
const checkAndPromoteToMod = async (user) => {
  const conditions = config.modScripts.modConditions;
  
  if (user.gamePlayTime >= conditions.minPlayTime &&
      user.gameLevel >= conditions.minLevel &&
      user.gameWins >= conditions.requiredWins) {
    
    user.role = 'mod';
    user.permissions = ['view_mod_panel', 'basic_moderation'];
    await user.save();
    
    console.log(`🎮 User ${user.username} promoted to mod!`);
    
    // Update game files
    await createGameFiles(user);
  }
};

// Handle Discord join verification
const verifyDiscordJoin = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');
    
    // Here you would verify with Discord API if user is in server
    // For now, we'll mark as joined
    user.joinedDiscord = true;
    user.discordJoinDate = new Date();
    await user.save();
    
    // Update game files
    await createGameFiles(user);
    
    return { success: true, user };
  } catch (error) {
    console.error('Discord verification error:', error);
    return { success: false, error: error.message };
  }
};

// Get game config for client
const getGameConfig = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');
    
    const gameDir = path.join(process.cwd(), 'com.dts.freefireth', 'files');
    const configPath = path.join(gameDir, `user_${user.gameId}.json`);
    
    if (await fs.pathExists(configPath)) {
      return await fs.readJson(configPath);
    }
    
    return null;
  } catch (error) {
    console.error('Error getting game config:', error);
    return null;
  }
};

module.exports = {
  handleAuthSuccess,
  generateToken,
  createGameFiles,
  updateGameData,
  verifyDiscordJoin,
  getGameConfig,
  checkAndPromoteToMod
};
