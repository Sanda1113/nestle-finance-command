module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/__tests__/**/*.test.js'],
    collectCoverageFrom: ['routes/**/*.js', 'server.js', '!**/node_modules/**'],
};