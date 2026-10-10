module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['react-native-gesture-handler/jestSetup', './jest.setup.js'],
  // Reanimated 4's shipped test mock still boots its native module chain,
  // which cannot initialize under jest. We map to a local lightweight mock
  // (jest/reanimated-mock.js) covering the API subset the app uses.
  moduleNameMapper: {
    '^react-native-reanimated$': '<rootDir>/jest/reanimated-mock.js',
    '^react-native-haptic-feedback$': '<rootDir>/jest/haptic-feedback-mock.js',
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/jest/async-storage-mock.js',
    '^lucide-react-native$':
      '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
  },
  // Babel-transform RN-adjacent packages that ship untranspiled code.
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-reanimated|react-native-worklets|react-native-gesture-handler|react-native-svg|react-native-haptic-feedback|lucide-react-native)/)',
  ],
};
