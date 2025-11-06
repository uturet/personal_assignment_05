const swaggerAutogen = require('swagger-autogen')({ openapi: '3.0.0' });

const doc = {
  info: {
    title: 'Event Scheduler',
    description: 'API for managing users and events with subscription-driven visibility.',
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Local server' },
    { url: 'https://personal-assignment-05.onrender.com', description: 'Production server' },
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'sid'
      },
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      },
      googleOAuth: {
        type: 'oauth2',
        flows: {
          authorizationCode: {
            authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
            tokenUrl: 'https://oauth2.googleapis.com/token',
            scopes: {
              'openid': 'OpenID scope',
              'email': 'Access to email',
              'profile': 'Access to basic profile'
            }
          }
        }
      }
    }
  },
  // Make cookieAuth the default for every operation (you can override per-route)
  security: [{ cookieAuth: [] }]
};

const outputFile = './swagger-output.json';
const routes = ['./routes/index.js'];

/* NOTE: If you are using the express Router, you must pass in the 'routes' only the 
root file where the route starts, such as index.js, app.js, routes.js, etc ... */

swaggerAutogen(outputFile, routes, doc);
