import React from 'react';
import {
  TextInput,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../design';
import { Stack } from './Stack';
import { Text } from './Text';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  /** Visible label above the field */
  label: string;
  /** Validation message shown under the field (reserve space, no jumping) */
  error?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Labeled text field with inline validation. Errors are announced
 * politely; the layout reserves the error line so forms never jump.
 */
export function TextField({ label, error, style, ...rest }: TextFieldProps) {
  const { colors, typography, spacing, radius } = useTheme();

  return (
    <Stack gap="xs" align="stretch" style={style}>
      <Text variant="label">{label}</Text>
      <TextInput
        {...rest}
        placeholderTextColor={colors.textMuted}
        style={{
          ...typography.body,
          color: colors.textPrimary,
          backgroundColor: colors.surfaceSunken,
          borderRadius: radius.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
        }}
      />
      <Text
        variant="caption"
        color={error ? 'danger' : 'primary'}
        accessibilityLiveRegion="polite"
        style={{ minHeight: 18 }}
      >
        {error ?? ' '}
      </Text>
    </Stack>
  );
}
