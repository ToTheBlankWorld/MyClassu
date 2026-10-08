import React from 'react';
import { View } from 'react-native';
import { MapPin, User } from 'lucide-react-native';
import { useTheme } from '../../../design';
import { Icon } from '../../../components/Icon';
import { Row, Stack } from '../../../components/Stack';
import { Surface } from '../../../components/Surface';
import { Text } from '../../../components/Text';
import type { DashboardTimelineEntry } from '../dashboard';

export interface ClassTimelineItemProps {
  entry: DashboardTimelineEntry;
}

/**
 * One row of the Today timeline. Visual weight encodes state: the running
 * class gets a tinted active treatment with a NOW badge, upcoming classes
 * stay clear, completed classes go quiet.
 */
export function ClassTimelineItem({ entry }: ClassTimelineItemProps) {
  const { colors, spacing, radius } = useTheme();
  const isCurrent = entry.status === 'current';
  const isCompleted = entry.status === 'completed';

  const titleColor = isCompleted ? 'muted' : 'primary';
  const metaColor = isCompleted ? 'muted' : 'secondary';
  const timeColor = isCurrent ? 'accent' : isCompleted ? 'muted' : 'secondary';

  const row = (
    <Row gap="md" align="stretch">
      <Stack gap={0} align="start" style={{ width: 76 }}>
        <Text variant="label" color={timeColor}>
          {entry.startTimeLabel}
        </Text>
        <Text variant="metadata" color="muted">
          {isCurrent ? 'now' : `– ${entry.endTimeLabel}`}
        </Text>
      </Stack>
      <Stack gap={2} align="start" style={{ flex: 1 }}>
        <Text variant="title" color={titleColor}>
          {entry.courseTitle}
        </Text>
        <Row gap="sm" align="center" style={{ flexWrap: 'wrap' }}>
          <Text variant="caption" color={metaColor}>
            {entry.courseCode}
          </Text>
          {entry.room ? (
            <Row gap={4} align="center">
              <Icon glyph={MapPin} size="xs" color={metaColor} />
              <Text variant="caption" color={metaColor}>
                {entry.room}
              </Text>
            </Row>
          ) : null}
          {entry.instructor ? (
            <Row gap={4} align="center">
              <Icon glyph={User} size="xs" color={metaColor} />
              <Text variant="caption" color={metaColor}>
                {entry.instructor}
              </Text>
            </Row>
          ) : null}
        </Row>
      </Stack>
      {isCurrent ? (
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.accent,
            marginTop: spacing.sm + 2,
          }}
        />
      ) : null}
    </Row>
  );

  if (isCurrent) {
    return (
      <Surface
        bordered={false}
        style={{
          backgroundColor: colors.accentTint,
          borderRadius: radius.lg,
          padding: spacing.lg,
        }}
        accessibilityLabel={accessibilitySummary(entry)}
      >
        {row}
      </Surface>
    );
  }

  return (
    <View
      style={{ paddingVertical: spacing.xs, opacity: isCompleted ? 0.55 : 1 }}
      accessibilityLabel={accessibilitySummary(entry)}
    >
      {row}
    </View>
  );
}

function accessibilitySummary(entry: DashboardTimelineEntry): string {
  const state =
    entry.status === 'current'
      ? 'Happening now'
      : entry.status === 'completed'
      ? 'Completed'
      : 'Upcoming';
  const room = entry.room ? `, room ${entry.room}` : '';
  return `${state}: ${entry.courseTitle}, ${entry.courseCode}, ${entry.startTimeLabel} to ${entry.endTimeLabel}${room}`;
}
