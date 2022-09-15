module.exports = {
  watchman: false,
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.(ts)$': 'ts-jest',
  },
  testRegex: '.test.ts$',
  testPathIgnorePatterns: ['dist'],
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
    },
  },
}
