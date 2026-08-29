const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { handleAuthSuccess } = require('../controllers/authController');

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const authResult = await handleAuthSuccess({
      id: profile.id,
      username: profile.displayName,
      displayName: profile.displayName,
      email: profile.emails?.[0]?.value || `${profile.id}@google.com`,
      avatar: profile.photos?.[0]?.value
    }, 'google', done);
    
    return authResult;
  } catch (error) {
    return done(error, null);
  }
}));

module.exports = passport;
