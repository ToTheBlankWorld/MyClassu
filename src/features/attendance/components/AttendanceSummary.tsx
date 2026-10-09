import React from 'react';
import { CalendarCheck } from 'lucide-react-native';
import { useTheme } from '../../../design';
import {
  Card,
  EmptyState,
  ProgressIndicator,
  Row,
  Stack,
  Text,
} from '../../../components';
import type { AttendanceSummary } from '../analytics';

/**
 * Shared attendance overview card (Attendance + Stats screens): big
 * percentage, decided denominator, attended/missed split. Renders an
 * intentional empty state when nothing is decided yet — never NaN or a
 * misleading 0%.
 */
export function AttendanceSummaryCard({
  summary,
}: {
  summary: AttendanceSummary;
}) {
  const { spacing } = useTheme();

  if (summary.decided === 0 || summary.percentage === null) {
    return (
      <Card level="base" style={{ padding: spacing.xl }}>
        <EmptyState
          icon={CalendarCheck}
          title="No attendance yet"
          message="Your attendance percentage appears here once you mark your first class."
        />
      </Card>
    );
  }

  return (
    <Card
      level="base"
      style={{ padding: spacing.xl }}
      accessibilityLabel={`Attendance ${summary.percentage} percent, ${summary.attended} attended out of ${summary.decided} decided classes`}
    >
      <Stack gap="sm" align="stretch">
        <Row justify="between" align="center">
          <Text variant="metadata" color="muted">
            {'ATTENDANCE'}
          </Text>
          <Text variant="caption" color="muted">
            {`${summary.decided} decided`}
          </Text>
        </Row>
        <Text variant="display">{`${summary.percentage}%`}</Text>
        <ProgressIndicator
          value={summary.percentage / 100}
          accessibilityLabel="Overall attendance progress"
        />
        <Text variant="bodySmall" color="secondary">
          {`${summary.attended} attended · ${summary.missed} missed`}
        </Text>
      </Stack>
    </Card>
  );
}
