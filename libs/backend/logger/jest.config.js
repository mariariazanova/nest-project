const { pathsToModuleNameMapper } = require('ts-jest');
// eslint-disable-next-line @nx/enforce-module-boundaries
const { compilerOptions } = require('../../../tsconfig.base.json');

module.exports = {
  displayName: 'logger',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  transformIgnorePatterns: ['node_modules/(?!(uuid)/)'],
  testMatch: ['**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, {
    prefix: '<rootDir>/../../../',
  }),
  coverageDirectory: '../../../coverage/libs/backend/logger',
};
