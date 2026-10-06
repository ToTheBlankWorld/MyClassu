import React from 'react';
import { ActivityIndicator } from 'react-native';
import { useTheme } from '../design';
import { Stack } from './Stack';
import { Text } from './Text';

export interface LoadingStateProps {
  /** What is being loaded, e.g. "Loading your timetable" */
  label?: string;
}

/**
 * Shared loading-state presentation. Skeleton variants arrive with the
 * timetable UI; this covers generic in-progress states.
 */
export function LoadingState({ label = 'Loading…' }: LoadingStateProps) {
  const { colors, spacing } = useTheme();

  return (
    <Stack gap="lg" align="center" style={{ paddingVertical: spacing.xxxl }}>
      <ActivityIndicator color={colors.accent} />
      <Text variant="caption" color="muted">
        {label}
      </Text>
    </Stack>
  );
}
