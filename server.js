
// Add this to your server.js file in the middleware section:
const { strictLimiter, standardLimiter } = require('./src/middleware/rateLimiter');

// Apply strict limiter to loan/repay endpoints
app.use('/api/loan', strictLimiter);
app.use('/api/repay', strictLimiter);

// Apply standard limiter to read endpoints
app.use('/api/loans', standardLimiter);
app.use('/api/users', standardLimiter);
