import React from 'react';
import { useTheme } from '../design';
import { Stack } from './Stack';
import { Text } from './Text';

export interface EmptyStateProps {
  /** Large glyph shown in the tinted circle */
  glyph?: string;
  title: string;
  message: string;
  /** Optional call to action (e.g. a <Button />) */
  action?: React.ReactNode;
}

/**
 * Shared empty-state presentation. Screens own *when* it is shown; this
 * component owns *how* it looks.
 */
export function EmptyState({
  glyph = '✓',
  title,
  message,
  action,
}: EmptyStateProps) {
  const { colors, spacing, radius } = useTheme();

  return (
    <Stack gap="lg" align="center" style={{ paddingVertical: spacing.xxxl }}>
      <Stack
        gap={0}
        align="center"
        style={{
          width: 72,
          height: 72,
          borderRadius: radius.pill,
          backgroundColor: colors.surfaceSunken,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text variant="heading" color="muted">
          {glyph}
        </Text>
      </Stack>
      <Stack gap="sm" align="center">
        <Text variant="title" align="center">
          {title}
        </Text>
        <Text variant="caption" color="secondary" align="center">
          {message}
        </Text>
      </Stack>
      {action}
    </Stack>
  );
}
