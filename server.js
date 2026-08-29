require('dotenv').config();
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const passport = require('passport');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs-extra');
const config = require('./config/localconfig.json');

// Import auth strategies
require('./auth/discord');
require('./auth/facebook');
require('./auth/google');

// Import routes
const authRoutes = require('./routes/authRoutes');

const app = express();

// Ensure game files directory exists
const gameDir = path.join(process.cwd(), 'com.dts.freefireth', 'files');
fs.ensureDirSync(gameDir);

// Copy localconfig to game files
fs.copySync(
  path.join(process.cwd(), 'config', 'localconfig.json'),
  path.join(gameDir, 'localconfig.json'),
  { overwrite: true }
);

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Middleware
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}));

// Passport
app.use(passport.initialize());
app.use(passport.session());

// Serialize/Deserialize
passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const User = require('./models/User');
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Routes
app.use('/auth', authRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date(),
    gameDir: gameDir,
    config: config
  });
});

// Game config endpoint for game client
app.get('/game/config', async (req, res) => {
  try {
    const token = req.query.token;
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    // Verify token and get user
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const User = require('./models/User');
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get game config
    const configPath = path.join(gameDir, `user_${user.gameId}.json`);
    let gameConfig;
    
    if (await fs.pathExists(configPath)) {
      gameConfig = await fs.readJson(configPath);
    } else {
      // Generate default config
      gameConfig = {
        userId: user._id.toString(),
        gameId: user.gameId,
        username: user.username,
        displayName: user.displayName,
        level: user.gameLevel,
        stats: user.gameStats,
        authType: user.authType,
        joinedDiscord: user.joinedDiscord,
        role: user.role,
        permissions: user.permissions
      };
      await fs.writeJson(configPath, gameConfig, { spaces: 2 });
    }
    
    res.json({
      success: true,
      config: gameConfig,
      discord: {
        required: config.auth.requireDiscordJoin,
        serverId: config.auth.discordServerId,
        link: 'https://discord.gg/k6R6CKw7Q'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 FreeFire Auth Server running on http://localhost:${PORT}`);
  console.log(`📁 Game files directory: ${gameDir}`);
  console.log(`🎮 Discord: https://discord.gg/k6R6CKw7Q`);
  console.log(`\n🔐 Auth endpoints:`);
  console.log(`  - Discord: http://localhost:${PORT}/auth/discord`);
  console.log(`  - Facebook: http://localhost:${PORT}/auth/facebook`);
  console.log(`  - Google: http://localhost:${PORT}/auth/google`);
  console.log(`  - Login: http://localhost:${PORT}/auth/login`);
  console.log(`  - Register: http://localhost:${PORT}/auth/register`);
});
