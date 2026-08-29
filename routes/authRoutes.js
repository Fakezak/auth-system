const express = require('express');
const passport = require('passport');
const router = express.Router();
// Fix: Use correct relative path
const { isAuthenticated, generateToken } = require('../middleware/auth');
const { verifyDiscordJoin, getGameConfig, createGameFiles, generateGameId } = require('../controllers/authController');
const User = require('../models/User');
const config = require('../config/localconfig.json');

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
    await createGameFiles(user);
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
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
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 20px;
        }
        .container {
          background: white;
          padding: 50px 40px;
          border-radius: 20px;
          text-align: center;
          max-width: 450px;
          width: 100%;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          animation: slideUp 0.6s ease-out;
        }
        @keyframes slideUp {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .icon { font-size: 64px; margin-bottom: 20px; }
        h1 { color: #2d3748; font-size: 28px; margin-bottom: 10px; }
        p { color: #718096; font-size: 16px; line-height: 1.6; margin: 15px 0; }
        .discord-btn {
          background: #5865F2;
          color: white;
          border: none;
          padding: 16px 40px;
          font-size: 18px;
          font-weight: 600;
          border-radius: 12px;
          cursor: pointer;
          margin: 15px 0 10px;
          transition: all 0.3s;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        .discord-btn:hover {
          transform: scale(1.02);
          background: #4752C4;
          box-shadow: 0 8px 25px rgba(88, 101, 242, 0.4);
        }
        .discord-btn:active { transform: scale(0.98); }
        .back-btn {
          background: #e2e8f0;
          color: #2d3748;
          border: none;
          padding: 12px 30px;
          font-size: 15px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s;
          margin-top: 10px;
          width: 100%;
        }
        .back-btn:hover { background: #cbd5e0; }
        .loading {
          display: none;
          margin: 20px 0;
        }
        .spinner {
          border: 4px solid #f3f3f3;
          border-top: 4px solid #5865F2;
          border-radius: 50%;
          width: 50px;
          height: 50px;
          animation: spin 1s linear infinite;
          margin: 0 auto 15px;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .status { 
          font-size: 14px; 
          color: #48bb78; 
          margin-top: 10px;
          display: none;
        }
        .server-id {
          background: #f7fafc;
          padding: 10px;
          border-radius: 8px;
          font-size: 13px;
          color: #4a5568;
          margin-top: 15px;
        }
        .server-id code {
          background: #e2e8f0;
          padding: 2px 10px;
          border-radius: 4px;
          font-weight: 600;
          color: #2d3748;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">🎮</div>
        <h1>Join Our Discord</h1>
        <p>To continue playing FreeFire, you must join our community!<br>This helps us verify real players.</p>
        
        <button class="discord-btn" onclick="joinDiscord()">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
          </svg>
          Join Discord Server
        </button>
        
        <div class="loading" id="loading">
          <div class="spinner"></div>
          <p style="color: #4a5568;">Verifying Discord membership...</p>
          <div class="status" id="status">✅ Verified! Redirecting...</div>
        </div>
        
        <button class="back-btn" onclick="backToGame()">
          ← Return to Game
        </button>
        
        <div class="server-id">
          Discord Server: <code>k6R6CKw7Q</code>
        </div>
      </div>

      <script>
        const userId = "${userId || ''}";
        let verificationInterval;
        let attempts = 0;
        const maxAttempts = 10;
        
        async function joinDiscord() {
          const discordWindow = window.open('https://discord.gg/k6R6CKw7Q', '_blank');
          
          document.getElementById('loading').style.display = 'block';
          document.querySelector('.discord-btn').disabled = true;
          document.querySelector('.discord-btn').style.opacity = '0.6';
          
          // Start verification
          verificationInterval = setInterval(checkVerification, 3000);
          
          // Auto redirect after 30 seconds if not verified
          setTimeout(() => {
            if (!window.verified) {
              document.getElementById('loading').style.display = 'none';
              document.querySelector('.discord-btn').disabled = false;
              document.querySelector('.discord-btn').style.opacity = '1';
              alert('Please join the Discord server and click "Return to Game"');
            }
          }, 30000);
        }
        
        async function checkVerification() {
          if (!userId) return;
          
          attempts++;
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
              document.getElementById('loading').style.display = 'block';
              document.getElementById('status').style.display = 'block';
              document.querySelector('.spinner').style.display = 'none';
              
              setTimeout(() => {
                backToGame();
              }, 2000);
            } else if (attempts >= maxAttempts) {
              clearInterval(verificationInterval);
              document.getElementById('loading').style.display = 'none';
              document.querySelector('.discord-btn').disabled = false;
              document.querySelector('.discord-btn').style.opacity = '1';
            }
          } catch (error) {
            console.error('Verification error:', error);
            if (attempts >= maxAttempts) {
              clearInterval(verificationInterval);
              document.getElementById('loading').style.display = 'none';
            }
          }
        }
        
        function backToGame() {
          // Try to redirect back to game
          window.location.href = 'com.dts.freefireth://auth/success';
          
          // Fallback
          setTimeout(() => {
            window.location.href = '/auth/success';
          }, 1000);
        }
        
        // Auto-check on page load
        if (userId) {
          window.addEventListener('load', () => {
            setTimeout(checkVerification, 2000);
          });
        }
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
