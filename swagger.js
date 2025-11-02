const swaggerAutogen = require('swagger-autogen')({ openapi: '3.0.0' });

const doc = {
  info: {
    title: 'Events Service API',
    description:
      'API for managing users and events with subscription-driven visibility.',
  },
  servers: [
    {
      url: 'http://localhost:8080',
      description: 'Local server',
    },
    {
      url: 'https://personal-assignment-05.onrender.com',
      description: 'Production server',
    },
  ],
};

const outputFile = './swagger-output.json';
const routes = ['./routes/index.js'];

/* NOTE: If you are using the express Router, you must pass in the 'routes' only the 
root file where the route starts, such as index.js, app.js, routes.js, etc ... */

swaggerAutogen(outputFile, routes, doc);
