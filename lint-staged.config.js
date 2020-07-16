module.exports = {
  "*.{jsx,tsx,vue}": ["npm run lint -- --lint-staged"],
  "*.{js,ts}": ["npm run lint -- --lint-staged", "npm test -- --lint-staged --config jest.config.js"],
  "*.{json,less,css,md,gql,graphql,html,yaml}": ["npm run format -- --lint-staged"],
};
