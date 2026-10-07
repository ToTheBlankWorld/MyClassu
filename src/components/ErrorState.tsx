import React from 'react';
import { useTheme } from '../design';
import { CircleAlert } from 'lucide-react-native';
import { Button } from './Button';
import { Icon } from './Icon';
import { Stack } from './Stack';
import { Text } from './Text';

export interface ErrorStateProps {
  title: string;
  message: string;
  /** Provide to show a retry action */
  onRetry?: () => void;
  retryLabel?: string;
}

/**
 * Shared error-state presentation: what failed, what it means for the user,
 * and a way forward. Errors are calm — no giant icons, no alarm colors
 * beyond the small accent.
 */
export function ErrorState({
  title,
  message,
  onRetry,
  retryLabel = 'Try again',
}: ErrorStateProps) {
  const { colors, spacing, radius } = useTheme();

  return (
    <Stack gap="lg" align="center" style={{ paddingVertical: spacing.xxxl }}>
      <Stack
        gap={0}
        align="center"
        style={{
          width: 64,
          height: 64,
          borderRadius: radius.pill,
          backgroundColor: colors.dangerTint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon glyph={CircleAlert} size="lg" color="danger" />
      </Stack>
      <Stack gap="sm" align="center">
        <Text variant="title" align="center">
          {title}
        </Text>
        <Text variant="bodySmall" color="secondary" align="center">
          {message}
        </Text>
      </Stack>
      {onRetry ? (
        <Button variant="secondary" onPress={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </Stack>
  );
}
