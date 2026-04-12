module.exports = {
    testEnvironment: 'node',
    setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
    testMatch: ['**/__tests__/**/*.test.js'],
    collectCoverageFrom: ['routes/**/*.js', 'server.js'],
    coverageDirectory: 'coverage',
    moduleNameMapper: {
        '^mindee$': '<rootDir>/__mocks__/mindee.js',
    },
    transformIgnorePatterns: [
        'node_modules/(?!(mindee|@mindee|@supabase)/)',
    ],
    transform: {
        '^.+\\.(js|jsx|mjs|cjs|ts|tsx)$': 'babel-jest',
    },
};