const express = require('express');
const passport = require('passport');
const router = express.Router();
const { isAuthenticated, generateToken } = require('../middleware/auth');
const { verifyDiscordJoin, getGameConfig } = require('../controllers/authController');
const User = require('../models/User');

// ============ AUTH ROUTES ============

// Home
router.get('/', (req, res) => {
  res.json({
    message: 'FreeFire Authentication Server',
    endpoints: {
      discord: '/auth/discord',
      facebook: '/auth/facebook',
      google: '/auth/google',
      login: '/auth/login',
      register: '/auth/register',
      verify: '/auth/verify-discord',
      gameConfig: '/auth/game-config'
    }
  });
});

// Discord
router.get('/discord', passport.authenticate('discord'));

router.get('/discord/callback', 
  passport.authenticate('discord', { 
    failureRedirect: '/auth/failed',
    failureMessage: true
  }),
  (req, res) => {
    // Check if user needs to join Discord
    if (req.authInfo && req.authInfo.requiresDiscord) {
      return res.redirect(`/auth/require-discord?userId=${req.user._id}`);
    }
    res.redirect('/auth/success');
  }
);

// Facebook
router.get('/facebook', passport.authenticate('facebook', {
  scope: ['email']
}));

router.get('/facebook/callback',
  passport.authenticate('facebook', {
    failureRedirect: '/auth/failed'
  }),
  (req, res) => {
    if (req.authInfo && req.authInfo.requiresDiscord) {
      return res.redirect(`/auth/require-discord?userId=${req.user._id}`);
    }
    res.redirect('/auth/success');
  }
);

// Google
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

router.get('/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/auth/failed'
  }),
  (req, res) => {
    if (req.authInfo && req.authInfo.requiresDiscord) {
      return res.redirect(`/auth/require-discord?userId=${req.user._id}`);
    }
    res.redirect('/auth/success');
  }
);

// Normal login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ 
      email, 
      authType: 'normal' 
    }).select('+password');
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check if user needs to join Discord
    if (config.auth.requireDiscordJoin && !user.joinedDiscord) {
      return res.status(403).json({
        error: 'Discord required',
        discordLink: 'https://discord.gg/k6R6CKw7Q',
        userId: user._id
      });
    }
    
    user.lastLogin = new Date();
    user.loginCount += 1;
    await user.save();
    
    const token = generateToken(user);
    
    // Return game config
    const gameConfig = await getGameConfig(user._id);
    
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        gameId: user.gameId,
        gameLevel: user.gameLevel,
        joinedDiscord: user.joinedDiscord,
        gameConfig
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Normal register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    const existing = await User.findOne({ 
      $or: [{ username }, { email }] 
    });
    
    if (existing) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    
    const user = new User({
      username,
      email,
      password,
      authType: 'normal',
      isVerified: false,
      gameId: generateGameId()
    });
    
    await user.save();
    
    // Create game files
    await createGameFiles(user);
    
    res.status(201).json({
      success: true,
      message: 'User created. Please check your email for verification.',
      userId: user._id
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Require Discord page
router.get('/require-discord', (req, res) => {
  const userId = req.query.userId;
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Join Discord</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
          background: white;
          padding: 40px;
          border-radius: 10px;
          text-align: center;
          max-width: 400px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        h1 { color: #333; }
        p { color: #666; margin: 20px 0; }
        .discord-btn {
          background: #7289da;
          color: white;
          border: none;
          padding: 15px 40px;
          font-size: 18px;
          border-radius: 5px;
          cursor: pointer;
          margin: 10px 0;
          transition: transform 0.3s;
        }
        .discord-btn:hover {
          transform: scale(1.05);
        }
        .back-btn {
          background: #333;
          color: white;
          border: none;
          padding: 10px 30px;
          font-size: 14px;
          border-radius: 5px;
          cursor: pointer;
          margin-top: 10px;
        }
        .back-btn:hover {
          background: #555;
        }
        .loading {
          display: none;
          margin: 20px 0;
        }
        .spinner {
          border: 4px solid #f3f3f3;
          border-top: 4px solid #7289da;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin: 0 auto;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🎮 Join Our Discord</h1>
        <p>To continue playing FreeFire, you must join our Discord community!</p>
        <p style="font-size: 14px; color: #999;">
          This helps us verify real players and prevent bots.
        </p>
        <button class="discord-btn" onclick="joinDiscord()">
          🎮 Join Discord Server
        </button>
        <div class="loading" id="loading">
          <div class="spinner"></div>
          <p style="margin-top: 15px;">Verifying Discord membership...</p>
        </div>
        <br>
        <button class="back-btn" onclick="backToGame()">
          Return to Game
        </button>
        <p style="font-size: 12px; color: #999; margin-top: 20px;">
          Discord Server: k6R6CKw7Q
        </p>
      </div>

      <script>
        const userId = "${userId}";
        let verificationInterval;
        
        async function joinDiscord() {
          // Open Discord in new window
          const discordWindow = window.open('https://discord.gg/k6R6CKw7Q', '_blank');
          
          // Show loading
          document.getElementById('loading').style.display = 'block';
          
          // Start verification
          verificationInterval = setInterval(checkVerification, 3000);
          
          // Auto redirect after 5 seconds if not verified
          setTimeout(() => {
            // If not verified, user can manually verify
            if (!window.verified) {
              document.getElementById('loading').style.display = 'none';
              alert('Please join the Discord server and then click "Return to Game"');
            }
          }, 5000);
        }
        
        async function checkVerification() {
          try {
            const response = await fetch('/auth/verify-discord', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId })
            });
            
            const data = await response.json();
            
            if (data.success) {
              window.verified = true;
              clearInterval(verificationInterval);
              document.getElementById('loading').style.display = 'none';
              alert('✅ Discord verification successful! Redirecting to game...');
              backToGame();
            }
          } catch (error) {
            console.error('Verification error:', error);
          }
        }
        
        function backToGame() {
          // Auto redirect back to game
          window.location.href = 'com.dts.freefireth://auth/success';
          
          // If that doesn't work, try fallback
          setTimeout(() => {
            window.location.href = '/auth/success';
          }, 1000);
        }
        
        // Auto-check on page load
        window.addEventListener('load', () => {
          // Check if user already verified
          checkVerification();
        });
      </script>
    </body>
    </html>
  `);
});

// Verify Discord join
router.post('/verify-discord', async (req, res) => {
  try {
    const { userId } = req.body;
    const result = await verifyDiscordJoin(userId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Success page
router.get('/success', isAuthenticated, async (req, res) => {
  const gameConfig = await getGameConfig(req.user._id);
  
  res.json({
    success: true,
    message: 'Authentication successful!',
    user: {
      id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      authType: req.user.authType,
      role: req.user.role,
      gameId: req.user.gameId,
      gameLevel: req.user.gameLevel,
      joinedDiscord: req.user.joinedDiscord,
      gameConfig
    },
    redirect: 'com.dts.freefireth://auth/success'
  });
});

// Failed
router.get('/failed', (req, res) => {
  res.status(401).json({
    success: false,
    message: 'Authentication failed',
    error: req.session.messages || 'Unknown error'
  });
});

// Get game config
router.get('/game-config', isAuthenticated, async (req, res) => {
  try {
    const config = await getGameConfig(req.user._id);
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
