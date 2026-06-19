// Jest 30 configuration. Uses ts-jest preset; jest-circus is the default
// test runner since Jest 27, so the explicit `testRunner` line was dropped.
// Stays CommonJS (`module.exports`) because package.json has no `"type": "module"`.

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  clearMocks: true,
  preset: 'ts-jest',
  moduleFileExtensions: ['ts', 'js'],
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  verbose: true
}
