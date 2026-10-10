import React from 'react';
import { Switch, type StyleProp, type ViewStyle } from 'react-native';
import { haptics, useTheme } from '../design';
import { Row, Stack } from './Stack';
import { Text } from './Text';

export interface SwitchRowProps {
  /** Short label, e.g. "Class reminders" */
  label: string;
  /** One-line explanation shown under the label */
  description?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Labeled settings switch. State is text as well as color (the value is
 * announced by screen readers), with a light haptic on toggle.
 */
export function SwitchRow({
  label,
  description,
  value,
  onValueChange,
  accessibilityLabel,
  style,
}: SwitchRowProps) {
  const { colors } = useTheme();

  return (
    <Row gap="md" align="center" style={style}>
      <Stack gap={2} align="start" style={{ flex: 1 }}>
        <Text variant="label">{label}</Text>
        {description ? (
          <Text variant="caption" color="secondary">
            {description}
          </Text>
        ) : null}
      </Stack>
      <Switch
        value={value}
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
        accessibilityLabel={accessibilityLabel ?? label}
        trackColor={{ false: colors.surfaceSunken, true: colors.accent }}
        thumbColor={colors.textOnAccent}
        onValueChange={next => {
          haptics.light();
          onValueChange(next);
        }}
      />
    </Row>
  );
}
