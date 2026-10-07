/**
 * Inert stand-in for react-native-haptic-feedback. The real module calls
 * TurboModuleRegistry.getEnforcing at import time, which throws under jest;
 * haptics are enhancement-only, so tests map the package here. Tests that
 * assert haptic behavior jest.mock it themselves with a spy.
 */
const trigger = () => undefined;

module.exports = {
  __esModule: true,
  default: { trigger },
  trigger,
};
