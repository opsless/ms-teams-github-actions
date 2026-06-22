/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  clearMocks: true,
  extensionsToTreatAsEsm: ['.ts'],
  moduleFileExtensions: ['ts', 'js'],
  preset: 'ts-jest',
  resolver: 'ts-jest-resolver',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: ['/dist/', '/node_modules/'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
        useESM: true
      }
    ]
  },
  verbose: true
}
