import HapticStub from 'react-native-haptic-feedback';
import { haptics } from './haptics';

/**
 * Haptic abstraction: semantic intents map to the right native trigger
 * types, and failures never escape (haptics are enhancement-only).
 *
 * Under jest the native package is mapped to an inert stub
 * (jest/haptic-feedback-mock.js); we spy on its trigger function.
 */

describe('haptics abstraction', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps semantic intents to native trigger types', () => {
    const spy = jest.spyOn(HapticStub, 'trigger');

    haptics.light();
    expect(spy).toHaveBeenLastCalledWith('impactLight', expect.any(Object));
    haptics.medium();
    expect(spy).toHaveBeenLastCalledWith('impactMedium', expect.any(Object));
    haptics.success();
    expect(spy).toHaveBeenLastCalledWith(
      'notificationSuccess',
      expect.any(Object),
    );
    haptics.warning();
    expect(spy).toHaveBeenLastCalledWith(
      'notificationWarning',
      expect.any(Object),
    );
    haptics.error();
    expect(spy).toHaveBeenLastCalledWith(
      'notificationError',
      expect.any(Object),
    );
    haptics.selection();
    expect(spy).toHaveBeenLastCalledWith('selection', expect.any(Object));
  });

  it('never throws when the native layer fails', () => {
    jest.spyOn(HapticStub, 'trigger').mockImplementation(() => {
      throw new Error('no vibrator');
    });
    expect(() => haptics.light()).not.toThrow();
    expect(() => haptics.selection()).not.toThrow();
  });

  it('never throws when the native module is missing', () => {
    jest.isolateModules(() => {
      jest.doMock('react-native-haptic-feedback', () => ({
        __esModule: true,
        default: undefined,
      }));
      const isolated = require('./haptics').haptics as typeof haptics;
      expect(() => isolated.light()).not.toThrow();
    });
  });
});
