const express = require('express');
const cors = require('cors');
const mongodb = require('./db');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const port = process.env.PORT || 3000;
const app = express();

const swagger = require('swagger-ui-express');
const swaggerDocs = require('./swagger-output.json');


passport.serializeUser((user, done) => {
  done(null, { id: user.id, firstName: user.givenName, lastName: user.familyName, emails: user.emails });
});
passport.deserializeUser((obj, done) => {
  done(null, obj);
});

passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
  },
  async (accessToken, refreshToken, profile, done) => {
    const Users = mongodb.getDb().collection('users');
    let user = await Users.findOne({ googleId: profile.id });
    let id = ""
    if (!user) {
      result = await Users.insertOne({
        googleId: profile.id,
        email: profile.emails[0].value,
        firstName: profile.name.givenName,
        lastName: profile.name.familyName,
        avatar: profile.photos[0].value,
        createdAt: new Date(),
        subscribetTo: []
      });
      id = result.insertedId.toString()
    } else {
      id = user._id.toString()
    }

    const userRecord = {
      id: id,
      firstName: profile.name.givenName,
      lastName: profile.name.familyName,
      avatar: profile.photos[0].value,
    };

    return done(null, userRecord);
  }
));

app.set('trust proxy', 1);
app.use(session({
  name: 'sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 1000 * 60 * 60 * 8
  }
}));
app.use(passport.initialize());
app.use(passport.session());

const ensureLoggedIn = (req, res, next) => {
  if (req.isAuthenticated?.()) return next();
  res.redirect('/login');
};

app.get('/login', (req, res) => {
  res.type('html').send(`
    <h1>Login</h1>
    <a href="/auth/google">Sign in with Google</a>
  `);
});

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => res.redirect('/api-docs')
);

app.get('/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    req.session.destroy(() => res.redirect('/'));
  });
});

app
  .use(cors())
  .use(express.json())
  .use(express.static('public'))
  .use('/api-docs', ensureLoggedIn, swagger.serve, swagger.setup(swaggerDocs))
  .use('/', ensureLoggedIn, require('./routes'));

mongodb.initDb((err, mongodb) => {
  if (err) {
    console.log(err);
  } else {
    app.listen(port);
    console.log(`Connected to DB and listening on ${port}`);
  }
});
