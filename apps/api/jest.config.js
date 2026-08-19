const path = require('node:path');

/** Unit test: khong can database, chay nhanh. */
module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testRegex: '\\.spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@t-hotel/shared-types$': path.join(__dirname, '..', '..', 'packages', 'shared-types', 'src', 'index.ts'),
  },
  clearMocks: true,
};
