import React from 'react';
import { View } from 'react-native';
import { MapPin, User } from 'lucide-react-native';
import type { ScheduleStatus } from '../../../domain/models';
import { useTheme } from '../../../design';
import { Icon } from '../../../components/Icon';
import { ProgressIndicator } from '../../../components/ProgressIndicator';
import { Row, Stack } from '../../../components/Stack';
import { Surface } from '../../../components/Surface';
import { Text } from '../../../components/Text';

/**
 * Structural timeline entry. Both the Home dashboard entries and the
 * Schedule day entries satisfy this shape, so one component renders both
 * timelines with identical visual language.
 */
export interface TimelineEntryLike {
  courseCode: string;
  courseTitle: string;
  room?: string;
  instructor?: string;
  startTimeLabel: string;
  endTimeLabel: string;
  status: ScheduleStatus;
}

export interface ClassTimelineItemProps {
  entry: TimelineEntryLike;
  /** e.g. "50 min" — shown after the course code when provided */
  durationLabel?: string;
  /** 0..1 — renders a slim progress bar when provided (running class) */
  progress?: number | null;
  /** Overrides the default TalkBack summary when provided */
  accessibilityLabel?: string;
}

/**
 * One row of a class timeline. Visual weight encodes state: the running
 * class gets a tinted active treatment, upcoming classes stay clear,
 * completed classes go quiet.
 */
export function ClassTimelineItem({
  entry,
  durationLabel,
  progress,
  accessibilityLabel,
}: ClassTimelineItemProps) {
  const { colors, spacing, radius } = useTheme();
  const isCurrent = entry.status === 'current';
  const isCompleted = entry.status === 'completed';

  const titleColor = isCompleted ? 'muted' : 'primary';
  const metaColor = isCompleted ? 'muted' : 'secondary';
  const timeColor = isCurrent ? 'accent' : isCompleted ? 'muted' : 'secondary';
  const label = accessibilityLabel ?? accessibilitySummary(entry);

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
          {durationLabel ? (
            <Text variant="caption" color={metaColor}>
              {`· ${durationLabel}`}
            </Text>
          ) : null}
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
        {progress != null ? (
          <ProgressIndicator
            value={progress}
            accessibilityLabel="Progress through the class"
            style={{ marginTop: spacing.sm, alignSelf: 'stretch' }}
          />
        ) : null}
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
        accessibilityLabel={label}
      >
        {row}
      </Surface>
    );
  }

  return (
    <View
      style={{ paddingVertical: spacing.xs, opacity: isCompleted ? 0.55 : 1 }}
      accessibilityLabel={label}
    >
      {row}
    </View>
  );
}

function accessibilitySummary(entry: TimelineEntryLike): string {
  const state =
    entry.status === 'current'
      ? 'Happening now'
      : entry.status === 'completed'
      ? 'Completed'
      : 'Upcoming';
  const room = entry.room ? `, room ${entry.room}` : '';
  return `${state}: ${entry.courseTitle}, ${entry.courseCode}, ${entry.startTimeLabel} to ${entry.endTimeLabel}${room}`;
}
