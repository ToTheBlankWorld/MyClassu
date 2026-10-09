import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { ChartColumn } from 'lucide-react-native';
import { Entrance, useTheme } from '../../design';
import {
  Divider,
  EmptyState,
  ErrorState,
  ProgressIndicator,
  Row,
  Screen,
  SectionHeader,
  Skeleton,
  Stack,
  Text,
} from '../../components';
import {
  breakdownReasons,
  buildWeeklyTrend,
  groupBySubject,
  summarizeAttendance,
} from '../../features/attendance/analytics';
import type { LocalAttendanceRecord } from '../../features/attendance/attendance';
import { AttendanceSummaryCard } from '../../features/attendance/components/AttendanceSummary';
import type { AttendanceRecordsStatus } from '../../features/attendance/useAttendanceRecords';
import { timetableService } from '../../features/timetable/service/timetableService';
import { zonedParts } from '../../utils/time';

export interface StatsViewProps {
  status: AttendanceRecordsStatus;
  records: LocalAttendanceRecord[];
  onRetry: () => void;
}

const TREND_WEEKS = 6;

/**
 * Presentational Stats screen: overview, subject breakdown, reason
 * insights, and a 6-week Monday-first trend. No projections — with sparse
 * early data they would mislead, so the trend explains itself instead.
 */
export function StatsView({ status, records, onRetry }: StatsViewProps) {
  if (status === 'loading') {
    return <StatsSkeleton />;
  }
  if (status === 'error') {
    return (
      <Screen>
        <Stack gap={0} style={{ flex: 1, justifyContent: 'center' }}>
          <ErrorState
            title="Couldn't load statistics"
            message="Your local attendance data couldn't be read. Retrying usually fixes it."
            onRetry={onRetry}
          />
        </Stack>
      </Screen>
    );
  }
  return <StatsContent records={records} />;
}

function StatsContent({ records }: { records: LocalAttendanceRecord[] }) {
  const { spacing } = useTheme();
  const summary = useMemo(() => summarizeAttendance(records), [records]);
  const subjects = useMemo(() => groupBySubject(records), [records]);
  const reasons = useMemo(() => breakdownReasons(records), [records]);
  const trend = useMemo(() => {
    const service = timetableService;
    const todayKey = zonedParts(new Date(), service.timezone).dateKey;
    return buildWeeklyTrend(records, todayKey, TREND_WEEKS, dateKey => {
      try {
        return service.getClassesForDateKey(dateKey).length;
      } catch {
        return 0;
      }
    });
  }, [records]);

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
                {'STATISTICS'}
              </Text>
              <Text variant="headingLarge">{'Insights'}</Text>
            </Stack>
          </Entrance>

          <Entrance delay={60}>
            <AttendanceSummaryCard summary={summary} />
          </Entrance>

          <Entrance delay={120}>
            <Stack gap="md" align="stretch">
              <SectionHeader title="By subject" />
              {subjects.length === 0 ? (
                <EmptyState
                  icon={ChartColumn}
                  title="No subjects yet"
                  message="Per-subject attendance appears here once you mark your first class."
                />
              ) : (
                <Stack gap="md" align="stretch">
                  {subjects.map((subject, index) => (
                    <Entrance
                      key={subject.courseCode}
                      delay={150 + index * 40}
                      distance={6}
                    >
                      <Stack gap="sm" align="stretch">
                        <Row justify="between" align="center">
                          <Stack gap={2} align="start" style={{ flex: 1 }}>
                            <Text variant="title">
                              {subject.subject !== ''
                                ? subject.subject
                                : subject.courseCode}
                            </Text>
                            <Text variant="caption" color="secondary">
                              {`${subject.courseCode} · ${subject.attended} attended · ${subject.missed} missed`}
                            </Text>
                          </Stack>
                          <Text
                            variant="label"
                            color="primary"
                            accessibilityLabel={`${
                              subject.percentage ?? 0
                            } percent`}
                          >
                            {subject.percentage === null
                              ? '—'
                              : `${subject.percentage}%`}
                          </Text>
                        </Row>
                        <ProgressIndicator
                          value={(subject.percentage ?? 0) / 100}
                          accessibilityLabel={`Attendance for ${
                            subject.courseCode
                          }: ${subject.percentage ?? 0} percent`}
                        />
                      </Stack>
                      {index < subjects.length - 1 ? <Divider /> : null}
                    </Entrance>
                  ))}
                </Stack>
              )}
            </Stack>
          </Entrance>

          <Entrance delay={180}>
            <Stack gap="md" align="stretch">
              <SectionHeader title="Why missed" />
              {reasons.length === 0 ? (
                <EmptyState
                  icon={ChartColumn}
                  title="Nothing missed"
                  message="When you miss a class with a reason, the breakdown appears here."
                />
              ) : (
                <Stack gap="sm" align="stretch">
                  {reasons.map(reason => (
                    <Row key={reason.value} justify="between" align="center">
                      <Text variant="body">{reason.label}</Text>
                      <Text
                        variant="caption"
                        color="secondary"
                        accessibilityLabel={`${reason.count} missed for ${reason.label}, ${reason.percentOfMissed} percent of missed`}
                      >
                        {`${reason.count} · ${reason.percentOfMissed}%`}
                      </Text>
                    </Row>
                  ))}
                </Stack>
              )}
            </Stack>
          </Entrance>

          <Entrance delay={240}>
            <Stack gap="md" align="stretch">
              <SectionHeader title="Recent weeks" />
              <TrendChart weeks={trend} empty={summary.decided === 0} />
            </Stack>
          </Entrance>
        </Stack>
      </ScrollView>
    </Screen>
  );
}

function TrendChart({
  weeks,
  empty,
}: {
  weeks: ReturnType<typeof buildWeeklyTrend>;
  empty: boolean;
}) {
  const { colors, radius, spacing } = useTheme();
  const decidedWeeks = weeks.filter(week => week.decided > 0).length;

  const summary = empty
    ? 'No attendance records yet, so there is no trend to show.'
    : decidedWeeks === 0
    ? 'No decided classes in the recent weeks.'
    : `${decidedWeeks} of the last ${weeks.length} weeks have decided classes.`;

  return (
    <Stack gap="md" align="stretch">
      <Row gap="sm" align="end" style={{ height: 120 }}>
        {weeks.map(week => {
          const fill = week.percentage === null ? 0 : week.percentage / 100;
          return (
            <Stack
              key={week.weekStartKey}
              gap={4}
              align="center"
              style={{ flex: 1 }}
            >
              <Text
                variant="metadata"
                color={week.percentage === null ? 'muted' : 'primary'}
              >
                {week.percentage === null ? '–' : `${week.percentage}%`}
              </Text>
              <View
                style={{
                  width: '100%',
                  height: 72,
                  borderRadius: radius.sm,
                  backgroundColor: colors.surfaceSunken,
                  justifyContent: 'flex-end',
                  overflow: 'hidden',
                }}
                accessibilityRole="image"
                accessibilityLabel={
                  week.percentage === null
                    ? `Week of ${week.label}: no decided classes`
                    : `Week of ${week.label}: ${week.percentage} percent, ${week.attended} attended, ${week.missed} missed, ${week.scheduled} scheduled`
                }
              >
                <View
                  style={{
                    width: '100%',
                    height:
                      week.percentage === null ? 3 : Math.max(8, 69 * fill),
                    backgroundColor:
                      week.percentage === null ? colors.border : colors.accent,
                    borderRadius: radius.sm,
                  }}
                />
              </View>
              <Text variant="metadata" color="muted">
                {week.label}
              </Text>
            </Stack>
          );
        })}
      </Row>
      <Text variant="caption" color="secondary">
        {empty
          ? 'Mark classes from the class-start alarm and your weekly trend will grow here.'
          : summary}
      </Text>
      {empty || decidedWeeks < weeks.length ? (
        <Text
          variant="caption"
          color="muted"
          style={{ marginTop: -spacing.sm }}
        >
          {'Weeks without decided classes show a flat marker — never a 0%.'}
        </Text>
      ) : null}
    </Stack>
  );
}

function StatsSkeleton() {
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
        <Skeleton
          height={90}
          radius="lg"
          accessibilityLabel="Loading subjects"
        />
        <Skeleton
          height={90}
          radius="lg"
          accessibilityLabel="Loading subjects"
        />
        <Skeleton height={120} radius="lg" accessibilityLabel="Loading trend" />
      </Stack>
    </Screen>
  );
}
