const swaggerAutogen = require('swagger-autogen')();

const doc = {
  openapi: '3.0.0',
  info: {
    title: 'Events Service API',
    description:
      'API for managing users and events with subscription-driven visibility.',
  },
  host: 'localhost:8080',
  schemes: ['http'],
};

const outputFile = './swagger-output.json';
const routes = ['./routes/index.js'];

/* NOTE: If you are using the express Router, you must pass in the 'routes' only the 
root file where the route starts, such as index.js, app.js, routes.js, etc ... */

swaggerAutogen(outputFile, routes, doc);
