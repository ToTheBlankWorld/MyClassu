import React from 'react';
import { View, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../design';

export interface ScreenProps extends ViewProps {
  /** Pad the screen by the safe-area insets (default: all) */
  safeEdges?:
    | ReadonlyArray<'top' | 'bottom' | 'left' | 'right'>
    | 'all'
    | false;
  /** Apply the standard screen gutter (spacing.xl) */
  padded?: boolean;
}

type Edge = 'top' | 'bottom' | 'left' | 'right';

/**
 * Root container for every screen: theme background, safe-area insets and the
 * standard horizontal gutter, combined (not overridden) per edge.
 */
export function Screen({
  safeEdges = 'all',
  padded = true,
  style,
  ...rest
}: ScreenProps) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const gutter = padded ? spacing.xl : 0;

  const inset: Record<Edge, number> = { top: 0, bottom: 0, left: 0, right: 0 };
  if (safeEdges === 'all') {
    inset.top = insets.top;
    inset.bottom = insets.bottom;
    inset.left = insets.left;
    inset.right = insets.right;
  } else if (safeEdges !== false) {
    for (const edge of safeEdges) {
      inset[edge] = insets[edge];
    }
  }

  return (
    <View
      {...rest}
      style={[
        { flex: 1, backgroundColor: colors.background },
        {
          paddingTop: inset.top,
          paddingBottom: inset.bottom,
          paddingLeft: inset.left + gutter,
          paddingRight: inset.right + gutter,
        },
        style,
      ]}
    />
  );
}
