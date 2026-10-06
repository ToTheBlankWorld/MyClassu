import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { useTheme } from '../design';

export interface DividerProps extends ViewProps {
  /** Vertical spacing above and below the divider */
  inset?: number;
}

export function Divider({ inset = 0, style, ...rest }: DividerProps) {
  const { colors } = useTheme();

  return (
    <View
      {...rest}
      style={[
        {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.border,
          marginVertical: inset,
        },
        style,
      ]}
    />
  );
}
