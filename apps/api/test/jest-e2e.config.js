const path = require('node:path');

const apiRoot = path.join(__dirname, '..');

/** Test e2e: goi HTTP that qua Supertest, database that do global-setup dung len. */
module.exports = {
  rootDir: apiRoot,
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testRegex: '\\.e2e-spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@t-hotel/shared-types$': path.join(apiRoot, '..', '..', 'packages', 'shared-types', 'src', 'index.ts'),
  },
  globalSetup: '<rootDir>/test/global-setup.js',
  globalTeardown: '<rootDir>/test/global-teardown.js',
  // initdb + start Postgres lan dau co the mat vai chuc giay tren Windows.
  testTimeout: 60000,
  clearMocks: true,
};
