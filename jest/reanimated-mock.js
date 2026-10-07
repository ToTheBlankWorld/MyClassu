/**
 * Lightweight jest stand-in for react-native-reanimated.
 *
 * Reanimated 4's shipped test mock still initializes its native module chain,
 * which cannot run under jest, so we map the package to this file (see
 * jest.config.js). It implements the subset of the API the app uses:
 * shared values, animated styles (evaluated synchronously to plain styles),
 * and animations that jump straight to their target value. Component tests
 * assert behavior (props, states, callbacks), not animation frames.
 */

const NOOP = () => undefined;
const identity = value => value;

/** Immediate linear interpolation between input/output ranges. */
function interpolate(value, inputRange, outputRange) {
  if (value <= inputRange[0]) {
    return outputRange[0];
  }
  if (value >= inputRange[inputRange.length - 1]) {
    return outputRange[outputRange.length - 1];
  }
  for (let i = 1; i < inputRange.length; i++) {
    if (value < inputRange[i]) {
      const t =
        (value - inputRange[i - 1]) / (inputRange[i] - inputRange[i - 1]);
      return outputRange[i - 1] + t * (outputRange[i] - outputRange[i - 1]);
    }
  }
  return outputRange[outputRange.length - 1];
}

function useSharedValue(initial) {
  return { value: initial };
}

/** Evaluate the style worklet once; components receive a plain style. */
function useAnimatedStyle(styleFactory) {
  return styleFactory();
}

function useDerivedValue(computation) {
  return { value: computation() };
}

function useReducedMotion() {
  return false;
}

function useAnimatedScrollHandler() {
  return {};
}

function useAnimatedRef() {
  const ref = { current: null };
  return ref;
}

function useAnimatedReaction() {
  return NOOP;
}

function measure() {
  return { x: 0, y: 0, width: 0, height: 0, pageX: 0, pageY: 0 };
}

function cancelAnimation(sharedValue) {
  return sharedValue?.value;
}

// Animations resolve to their target value immediately.
const withTiming = toValue => toValue;
const withSpring = toValue => toValue;
const withDecay = toValue => toValue;
const withDelay = (_delay, animation) => animation;
const withRepeat = animation => animation;
const withSequence = (...animations) => animations[animations.length - 1];
const withCallback = (animation, callback) => {
  callback(true);
  return animation;
};

function runOnJS(fn) {
  return fn;
}
function runOnUI(fn) {
  return fn;
}

const gestures = {
  Pan: () => makeGestureBuilder(),
  Tap: () => makeGestureBuilder(),
  LongPress: () => makeGestureBuilder(),
  Fling: () => makeGestureBuilder(),
  Pinch: () => makeGestureBuilder(),
  Race: (...g) => g[0],
  Simultaneous: (...g) => g[0],
  Exclusive: (...g) => g[0],
};

function makeGestureBuilder() {
  const builder = new Proxy(
    { handlers: {} },
    {
      get(target, prop) {
        if (prop === 'handlers') {
          return target.handlers;
        }
        return () => builder;
      },
      apply(target) {
        return target;
      },
    },
  );
  return builder;
}

const React = require('react');
const { View, Pressable } = require('react-native');

const Animated = {
  View,
  Text: require('react-native').Text,
  ScrollView: require('react-native').ScrollView,
  createAnimatedComponent: Component => Component,
};

// Named forwarders commonly used with the default import.
module.exports = {
  __esModule: true,
  default: Animated,
  Animated,
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useAnimatedScrollHandler,
  useAnimatedRef,
  useAnimatedReaction,
  useEvent: NOOP,
  useHandler: NOOP,
  useFrameCallback: NOOP,
  measure,
  cancelAnimation,
  interpolate,
  interpolateColor: (value, inputRange, outputRange) =>
    interpolate(value, inputRange, outputRange),
  withTiming,
  withSpring,
  withDecay,
  withDelay,
  withRepeat,
  withSequence,
  withCallback,
  runOnJS,
  runOnUI,
  Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
  Gesture: gestures,
  GestureDetector: ({ children }) =>
    React.createElement(React.Fragment, null, children),
  Frame: ({ children }) => React.createElement(React.Fragment, null, children),
  clamp: (value, lower, upper) => Math.min(Math.max(value, lower), upper),
  isSharedValue: () => false,
  processColor: identity,
  destroyWorklet: identity,
  getAnimatedStyle: NOOP,
  advanceAnimationByTime: NOOP,
  advanceAnimationByFrame: NOOP,
  withReanimatedTimer: identity,
  setUpTests: NOOP,
  initializeUIRuntime: NOOP,
  Pressable,
};
