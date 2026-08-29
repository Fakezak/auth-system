const passport = require('passport');
const FacebookStrategy = require('passport-facebook').Strategy;
const { handleAuthSuccess } = require('../controllers/authController');

passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_APP_ID,
  clientSecret: process.env.FACEBOOK_APP_SECRET,
  callbackURL: process.env.FACEBOOK_CALLBACK_URL,
  profileFields: ['id', 'displayName', 'email', 'name']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const authResult = await handleAuthSuccess({
      id: profile.id,
      username: profile.username || profile.displayName,
      displayName: profile.displayName,
      email: profile.emails?.[0]?.value || `${profile.id}@facebook.com`
    }, 'facebook', done);
    
    return authResult;
  } catch (error) {
    return done(error, null);
  }
}));

module.exports = passport;
