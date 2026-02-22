const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Proxy /super-admin requests to the super-admin frontend dev server
  app.use(
    '/super-admin',
    createProxyMiddleware({
      target: 'http://localhost:3002',
      changeOrigin: true,
    })
  );
};
