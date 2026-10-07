import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

/**
 * Central haptic abstraction — the ONLY module that talks to the native
 * haptic engine. UI code calls these semantic intents (light, success, …),
 * never the library directly. Haptics are enhancement-only: every call is
 * safe to fail silently (unsupported device, missing native module, tests).
 */

type TriggerType =
  | 'impactLight'
  | 'impactMedium'
  | 'notificationSuccess'
  | 'notificationWarning'
  | 'notificationError'
  | 'selection';

const OPTIONS = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

function trigger(type: TriggerType): void {
  try {
    ReactNativeHapticFeedback?.trigger?.(type, OPTIONS);
  } catch {
    // Haptics must never crash the app or surface errors.
  }
}

export const haptics = {
  /** Subtle tick: light presses, selection confirmation */
  light: () => trigger('impactLight'),
  /** Noticeable thud: significant state changes */
  medium: () => trigger('impactMedium'),
  /** Success notification pattern */
  success: () => trigger('notificationSuccess'),
  /** Warning notification pattern */
  warning: () => trigger('notificationWarning'),
  /** Error notification pattern */
  error: () => trigger('notificationError'),
  /** Selection changed (picker, tab, segmented control) */
  selection: () => trigger('selection'),
};

export type Haptics = typeof haptics;
