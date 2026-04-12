export default {
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
    moduleNameMapper: {
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
        '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/__mocks__/fileMock.js',
        '^lucide-react$': '<rootDir>/__mocks__/lucide-react.js',
    },
    transform: {
        '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
    },
    collectCoverageFrom: [
        'src/**/*.{js,jsx}',
        '!src/**/*.test.{js,jsx}',
        '!src/main.jsx',
    ],
};