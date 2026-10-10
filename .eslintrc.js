module.exports = {
  root: true,
  extends: '@react-native',
  // Generated output is never linted: Android build intermediates, the
  // Gradle cache, JS bundles, and coverage reports.
  ignorePatterns: [
    'android/app/build/',
    'android/app/.cxx/',
    'android/build/',
    'android/.gradle/',
    'coverage/',
  ],
};
