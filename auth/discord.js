const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const { handleAuthSuccess } = require('../controllers/authController');

passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: process.env.DISCORD_CALLBACK_URL,
  scope: ['identify', 'email', 'guilds']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const authResult = await handleAuthSuccess({
      id: profile.id,
      username: profile.username,
      displayName: profile.username,
      email: profile.email || `${profile.username}@discord.com`,
      avatar: profile.avatar,
      discriminator: profile.discriminator
    }, 'discord', done);
    
    return authResult;
  } catch (error) {
    return done(error, null);
  }
}));

module.exports = passport;
