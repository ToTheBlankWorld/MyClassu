import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pressable, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import {
  CircleAlert,
  CircleCheck,
  Info,
  TriangleAlert,
  X,
} from 'lucide-react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../design';
import { Card } from './Card';
import { Icon, type IconColorRole } from './Icon';
import { IconButton } from './IconButton';
import { Row } from './Stack';
import { Text } from './Text';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface ToastAction {
  label: string;
  onPress: () => void;
}

export interface ToastOptions {
  /** Short headline, e.g. "Attendance recorded" */
  title: string;
  /** Optional supporting line */
  message?: string;
  tone?: ToastTone;
  /** Optional inline action, e.g. "Undo" */
  action?: ToastAction;
  /** Override the default auto-dismiss (ms) */
  durationMs?: number;
}

interface ToastState {
  id: number;
  title: string;
  message: string | null;
  tone: ToastTone;
  action: ToastAction | null;
  durationMs: number;
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {
    // No provider mounted: toasts are dropped rather than crash the app.
  },
});

const DEFAULT_DURATION_MS = 4000;
const SWIPE_DISMISS_DISTANCE = 72;
const SWIPE_DISMISS_VELOCITY = 900;

const TONE_ICON: Record<ToastTone, LucideIcon> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleAlert,
};

const TONE_COLOR: Record<ToastTone, IconColorRole> = {
  info: 'accent',
  success: 'success',
  warning: 'warning',
  error: 'danger',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const nextId = useRef(1);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearToast = useCallback(() => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
    setToast(null);
  }, []);

  const showToast = useCallback((options: ToastOptions) => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
    setToast({
      id: nextId.current++,
      title: options.title,
      message: options.message ?? null,
      tone: options.tone ?? 'info',
      action: options.action ?? null,
      durationMs: options.durationMs ?? DEFAULT_DURATION_MS,
    });
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }
    dismissTimer.current = setTimeout(() => {
      setToast(null);
    }, toast.durationMs);
    return () => {
      if (dismissTimer.current) {
        clearTimeout(dismissTimer.current);
      }
    };
  }, [toast]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <ToastHost key={toast.id} toast={toast} onDismiss={clearToast} />
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

/**
 * Latest-wins toast host: one toast at a time, spring entrance, swipeable
 * horizontally to dismiss, manual close button, auto-expiry. Announced
 * politely to screen readers.
 */
function ToastHost({
  toast,
  onDismiss,
}: {
  toast: ToastState;
  onDismiss: () => void;
}) {
  const { colors, spacing, spring, duration, easing, zIndex, elevation } =
    useTheme();
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);
  const panX = useSharedValue(0);
  const closed = useSharedValue(false);

  useEffect(() => {
    progress.value = withSpring(1, spring.snappy);
  }, [progress, spring.snappy]);

  const finishDismiss = () => {
    if (!closed.value) {
      closed.value = true;
      onDismiss();
    }
  };

  const exit = (exitX = 0) => {
    progress.value = withTiming(
      0,
      { duration: duration.base, easing: easing.exit },
      finished => {
        if (finished) {
          runOnJS(finishDismiss)();
        }
      },
    );
    if (exitX !== 0) {
      panX.value = withTiming(exitX, {
        duration: duration.base,
        easing: easing.exit,
      });
    }
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-14, 14])
    .onUpdate(event => {
      panX.value = event.translationX;
    })
    .onEnd(event => {
      const far = Math.abs(panX.value) > SWIPE_DISMISS_DISTANCE;
      const fast = Math.abs(event.velocityX) > SWIPE_DISMISS_VELOCITY;
      if (far || fast) {
        const direction = panX.value >= 0 ? 1 : -1;
        runOnJS(exit)(direction * 420);
      } else {
        panX.value = withSpring(0, spring.snappy);
      }
    });

  const ToneIcon = TONE_ICON[toast.tone];
  const toneColor = TONE_COLOR[toast.tone];

  const wrapperStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [-18, 0]) },
      { translateX: panX.value },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        {
          position: 'absolute',
          top: insets.top + spacing.sm,
          left: 0,
          right: 0,
          zIndex: zIndex.toast,
          elevation: zIndex.toast,
        },
        wrapperStyle,
      ]}
    >
      <View pointerEvents="box-none" style={{ paddingHorizontal: spacing.xl }}>
        <GestureDetector gesture={pan}>
          <Card
            level="raised"
            style={[
              { paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
              elevation.level2,
            ]}
          >
            <View
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              accessibilityLabel={
                toast.message ? `${toast.title}. ${toast.message}` : toast.title
              }
            >
              <Row gap="md" align="start">
                <View style={{ paddingTop: 1 }}>
                  <Icon glyph={ToneIcon} size="md" color={toneColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="label" color="primary">
                    {toast.title}
                  </Text>
                  {toast.message ? (
                    <Text
                      variant="caption"
                      color="secondary"
                      style={{ marginTop: 2 }}
                    >
                      {toast.message}
                    </Text>
                  ) : null}
                  {toast.action ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={toast.action.label}
                      onPress={() => {
                        toast.action?.onPress();
                        exit(0);
                      }}
                      style={({ pressed }) => ({
                        alignSelf: 'flex-start',
                        marginTop: spacing.sm,
                        minHeight: 32,
                        justifyContent: 'center',
                        opacity: pressed ? 0.7 : 1,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.accent,
                      })}
                    >
                      <Text variant="label" color="accent">
                        {toast.action.label}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                <IconButton
                  glyph={X}
                  label="Dismiss notification"
                  size="sm"
                  haptic={false}
                  onPress={() => exit(0)}
                />
              </Row>
            </View>
          </Card>
        </GestureDetector>
      </View>
    </Animated.View>
  );
}
