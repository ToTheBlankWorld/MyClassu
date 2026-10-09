import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ClipboardCheck } from 'lucide-react-native';
import { Entrance, useTheme } from '../../design';
import {
  Chip,
  Divider,
  EmptyState,
  ErrorState,
  Icon,
  Row,
  Screen,
  SectionHeader,
  Skeleton,
  Stack,
  Text,
} from '../../components';
import { Check, X } from 'lucide-react-native';
import {
  buildHistory,
  summarizeAttendance,
  type HistoryEntry,
  type HistoryFilter,
} from '../../features/attendance/analytics';
import type { LocalAttendanceRecord } from '../../features/attendance/attendance';
import { AttendanceSummaryCard } from '../../features/attendance/components/AttendanceSummary';
import type { AttendanceRecordsStatus } from '../../features/attendance/useAttendanceRecords';

export interface AttendanceViewProps {
  status: AttendanceRecordsStatus;
  records: LocalAttendanceRecord[];
  onRetry: () => void;
}

const FILTERS: ReadonlyArray<{ value: HistoryFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'attended', label: 'Attended' },
  { value: 'missed', label: 'Missed' },
];

/**
 * Presentational Attendance screen: overview summary plus a filterable
 * chronological history. Pure w.r.t. data — records arrive via props.
 */
export function AttendanceView({
  status,
  records,
  onRetry,
}: AttendanceViewProps) {
  if (status === 'loading') {
    return <AttendanceSkeleton />;
  }
  if (status === 'error') {
    return (
      <Screen>
        <Stack gap={0} style={{ flex: 1, justifyContent: 'center' }}>
          <ErrorState
            title="Couldn't load attendance"
            message="Your local attendance data couldn't be read. Retrying usually fixes it."
            onRetry={onRetry}
          />
        </Stack>
      </Screen>
    );
  }
  return <AttendanceContent records={records} />;
}

function AttendanceContent({ records }: { records: LocalAttendanceRecord[] }) {
  const { spacing } = useTheme();
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const summary = useMemo(() => summarizeAttendance(records), [records]);
  const history = useMemo(
    () => buildHistory(records, filter),
    [records, filter],
  );

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Stack
          gap="xl"
          style={{ paddingTop: spacing.lg, paddingBottom: spacing.xl }}
        >
          <Entrance delay={0}>
            <Stack gap="xs" align="start">
              <Text variant="metadata" color="muted">
                {'ATTENDANCE'}
              </Text>
              <Text variant="headingLarge">{'Your classes'}</Text>
            </Stack>
          </Entrance>

          <Entrance delay={60}>
            <AttendanceSummaryCard summary={summary} />
          </Entrance>

          <Entrance delay={120}>
            <Stack gap="md" align="stretch">
              <SectionHeader title="History" />
              <Row gap="sm" align="center">
                {FILTERS.map(option => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    selected={filter === option.value}
                    onPress={() => setFilter(option.value)}
                    accessibilityLabel={`Show ${option.label.toLowerCase()} classes`}
                  />
                ))}
              </Row>
              {history.length === 0 ? (
                <EmptyState
                  icon={ClipboardCheck}
                  title={
                    filter === 'all'
                      ? 'No attendance yet'
                      : filter === 'attended'
                      ? 'No attended classes'
                      : 'No missed classes'
                  }
                  message={
                    filter === 'all'
                      ? 'Mark your first class from the class-start alarm.'
                      : filter === 'attended'
                      ? 'Classes you attend will appear here.'
                      : 'Good news — nothing missed so far.'
                  }
                />
              ) : (
                <Stack gap="md" align="stretch">
                  {history.map((entry, index) => (
                    <Entrance
                      key={entry.id}
                      delay={150 + index * 40}
                      distance={6}
                    >
                      <HistoryRow
                        entry={entry}
                        last={index === history.length - 1}
                      />
                    </Entrance>
                  ))}
                </Stack>
              )}
            </Stack>
          </Entrance>
        </Stack>
      </ScrollView>
    </Screen>
  );
}

function HistoryRow({ entry, last }: { entry: HistoryEntry; last: boolean }) {
  const { colors, spacing } = useTheme();
  const attended = entry.status === 'attended';

  return (
    <Stack gap={0} align="stretch">
      <Row gap="md" align="start">
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: attended ? colors.successTint : colors.dangerTint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon
            glyph={attended ? Check : X}
            size="sm"
            color={attended ? 'success' : 'danger'}
          />
        </View>
        <Stack gap={2} align="start" style={{ flex: 1 }}>
          <Text variant="title">
            {entry.subject !== '' ? entry.subject : entry.courseCode}
          </Text>
          <Text variant="caption" color="secondary">
            {`${formatHistoryDate(entry.dateKey)} · ${entry.courseCode}`}
          </Text>
          {!attended && entry.reasonLabel ? (
            <Text variant="caption" color="muted">
              {entry.customReason
                ? `${entry.reasonLabel} — ${entry.customReason}`
                : entry.reasonLabel}
            </Text>
          ) : null}
        </Stack>
        <Text variant="label" color={attended ? 'success' : 'danger'}>
          {attended ? 'Attended' : 'Missed'}
        </Text>
      </Row>
      {last ? null : <Divider style={{ marginTop: spacing.md }} />}
    </Stack>
  );
}

function formatHistoryDate(dateKey: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) {
    return dateKey;
  }
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${months[Number(match[2]) - 1]} ${Number(match[3])}`;
}

function AttendanceSkeleton() {
  const { spacing } = useTheme();

  return (
    <Screen>
      <Stack gap="lg" align="stretch" style={{ paddingTop: spacing.xl }}>
        <Skeleton
          width="40%"
          height={30}
          radius="md"
          accessibilityLabel="Loading heading"
        />
        <Skeleton
          height={170}
          radius="xl"
          accessibilityLabel="Loading summary"
        />
        <Skeleton width="30%" height={12} style={{ marginTop: spacing.md }} />
        <Skeleton
          height={64}
          radius="lg"
          accessibilityLabel="Loading history"
        />
        <Skeleton
          height={64}
          radius="lg"
          accessibilityLabel="Loading history"
        />
        <Skeleton
          height={64}
          radius="lg"
          accessibilityLabel="Loading history"
        />
      </Stack>
    </Screen>
  );
}
