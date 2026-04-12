export default {
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
    moduleNameMapper: {
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
        '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/__mocks__/fileMock.js',
        '^lucide-react$': '<rootDir>/__mocks__/lucide-react.js',
        '^axios$': '<rootDir>/__mocks__/axios.js',
    },
    transform: {
        '^.+\\.(js|jsx|mjs|cjs|ts|tsx)$': [
            'babel-jest',
            { presets: ['@babel/preset-env', ['@babel/preset-react', { runtime: 'automatic' }]] },
        ],
    },
    transformIgnorePatterns: [
        'node_modules/(?!(axios|html5-qrcode|recharts)/)',
    ],
    extensionsToTreatAsEsm: ['.jsx', '.ts', '.tsx'],
    collectCoverageFrom: [
        'src/**/*.{js,jsx}',
        '!src/**/*.test.{js,jsx}',
        '!src/main.jsx',
    ],
};