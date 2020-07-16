module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  coveragePathIgnorePatterns: ["<rootDir>/dist/", "<rootDir>/node_modules/", "/test-helper/", "<rootDir>/.eslintrc.js"],
  testPathIgnorePatterns: ["<rootDir>/dist/", "<rootDir>/node_modules/", "/test-helper/", "<rootDir>/.eslintrc.js"],
  coverageThreshold: { global: { branches: 100, functions: 100, lines: 100, statements: 100 } },
};
