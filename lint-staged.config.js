module.exports = {
  "!(module-files)/**/*.{jsx,tsx,vue}": ["npm run lint -- --lint-staged"],
  "!(module-files)/**/*.{js,ts}": ["npm run lint -- --lint-staged", "npm test -- --lint-staged --config jest.config.js"],
  "!(module-files)/**/*.{json,less,css,md,gql,graphql,html,yaml}": ["npm run format -- --lint-staged"],
};
