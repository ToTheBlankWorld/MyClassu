import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../design';
import { Card } from './Card';
import { Text } from './Text';

export type ToastTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

export interface ToastOptions {
  message: string;
  tone?: ToastTone;
}

interface ToastState extends Required<ToastOptions> {
  id: number;
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {
    // No provider mounted: toasts are dropped rather than crash the app.
  },
});

const AUTO_DISMISS_MS = 3500;

const TONE_GLYPH: Record<ToastTone, string> = {
  neutral: '•',
  accent: '★',
  success: '✓',
  warning: '!',
  danger: '×',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const nextId = useRef(1);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((options: ToastOptions) => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
    }
    setToast({
      id: nextId.current++,
      message: options.message,
      tone: options.tone ?? 'neutral',
    });
  }, []);

  const clearToast = useCallback(() => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
    setToast(null);
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }
    dismissTimer.current = setTimeout(() => {
      setToast(null);
    }, AUTO_DISMISS_MS);
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

function ToastHost({
  toast,
  onDismiss,
}: {
  toast: ToastState;
  onDismiss: () => void;
}) {
  const { colors, spacing, spring, duration, easing } = useTheme();
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: 1,
      useNativeDriver: true,
      ...spring.snappy,
    }).start();
    return () => {
      progress.stopAnimation();
    };
  }, [progress, spring.snappy]);

  const dismiss = () => {
    Animated.timing(progress, {
      toValue: 0,
      duration: duration.base,
      easing: easing.exit,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        onDismiss();
      }
    });
  };

  const toneColor =
    toast.tone === 'neutral'
      ? colors.textSecondary
      : toast.tone === 'accent'
      ? colors.accent
      : toast.tone === 'success'
      ? colors.success
      : toast.tone === 'warning'
      ? colors.warning
      : colors.danger;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: insets.top + spacing.sm,
        left: 0,
        right: 0,
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [-16, 0],
            }),
          },
        ],
      }}
    >
      <View pointerEvents="box-none" style={{ paddingHorizontal: spacing.xl }}>
        <Pressable accessibilityRole="alert" onPress={dismiss}>
          <Card
            level="raised"
            style={{ paddingVertical: spacing.sm, elevation: 4 }}
          >
            <View
              style={{
                flexDirection: 'row',
                gap: spacing.md,
                alignItems: 'center',
              }}
            >
              <Text variant="title" style={{ color: toneColor }}>
                {TONE_GLYPH[toast.tone]}
              </Text>
              <Text variant="label" color="primary" style={{ flex: 1 }}>
                {toast.message}
              </Text>
            </View>
          </Card>
        </Pressable>
      </View>
    </Animated.View>
  );
}
