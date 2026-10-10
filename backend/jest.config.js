/** @type {import('jest').Config} */
export default {
  testEnvironment: "node",
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/**/*.test.js",
    "!src/**/*.spec.js",
  ],
  // CI-safe: unit tests only (no live API / DB)
  testMatch: ["**/tests/unit/**/*.test.js"],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/tests/integration/",
    "auth\\.contract\\.test\\.js",
  ],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
};
