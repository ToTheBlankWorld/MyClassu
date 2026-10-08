import React from 'react';
import { ScrollView, View } from 'react-native';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react-native';
import {
  AnimatedPressable,
  Entrance,
  haptics,
  usePressScale,
  useTheme,
} from '../../design';
import {
  Button,
  EmptyState,
  ErrorState,
  IconButton,
  Row,
  Screen,
  Skeleton,
  Stack,
  Text,
} from '../../components';
import { ClassTimelineItem } from '../../features/timetable/components/ClassTimelineItem';
import type {
  ScheduleDay,
  ScheduleView as ScheduleViewData,
} from '../../features/timetable/schedule';
import type {
  ScheduleActions,
  ScheduleLoadStatus,
} from '../../features/timetable/useSchedule';

export interface ScheduleScreenViewProps {
  status: ScheduleLoadStatus;
  view: ScheduleViewData | null;
  actions: ScheduleActions;
  onRetry: () => void;
}

/**
 * Presentational Schedule screen: week strip, selected-day timeline with
 * schedule states, and intentional empty days. All data comes from the
 * timetable engine through the schedule selector — nothing here computes
 * schedule state itself. Week/day changes are explicit controls (chevrons,
 * day taps, Today) so vertical scrolling never fights a gesture.
 */
export function ScheduleView({
  status,
  view,
  actions,
  onRetry,
}: ScheduleScreenViewProps) {
  if (status === 'loading') {
    return <ScheduleSkeleton />;
  }
  if (status === 'error' || !view) {
    return (
      <Screen>
        <Stack gap={0} style={{ flex: 1, justifyContent: 'center' }}>
          <ErrorState
            title="Couldn't load your timetable"
            message="The timetable data on this device looks damaged. Retrying usually fixes it."
            onRetry={onRetry}
          />
        </Stack>
      </Screen>
    );
  }
  return <ScheduleContent view={view} actions={actions} />;
}

function ScheduleContent({
  view,
  actions,
}: {
  view: ScheduleViewData;
  actions: ScheduleActions;
}) {
  const { spacing } = useTheme();

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Stack
          gap="lg"
          style={{ paddingTop: spacing.lg, paddingBottom: spacing.xl }}
        >
          <Entrance delay={0}>
            <Stack gap="md" align="stretch">
              <Row justify="between" align="center">
                <IconButton
                  glyph={ChevronLeft}
                  label="Previous week"
                  size="sm"
                  onPress={actions.previousWeek}
                />
                <Text variant="title">{view.weekLabel}</Text>
                <IconButton
                  glyph={ChevronRight}
                  label="Next week"
                  size="sm"
                  onPress={actions.nextWeek}
                />
              </Row>
              <Row gap="sm" align="stretch">
                {view.weekDays.map(day => (
                  <DayCell
                    key={day.dateKey}
                    day={day}
                    onSelect={actions.selectDay}
                  />
                ))}
              </Row>
            </Stack>
          </Entrance>

          <Entrance delay={60}>
            <Row justify="between" align="center">
              <Stack gap={2} align="start">
                <Text variant="headingLarge">{view.dayHeading}</Text>
                <Text variant="bodySmall" color="secondary">
                  {view.daySummary}
                </Text>
              </Stack>
              {view.showTodayButton ? (
                <Button
                  variant="tertiary"
                  size="sm"
                  onPress={actions.goToToday}
                >
                  Today
                </Button>
              ) : null}
            </Row>
          </Entrance>

          <Entrance key={view.selectedKey} delay={0} distance={6}>
            {view.timeline.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title={`No classes ${
                  view.dayHeading === 'Today'
                    ? 'today'
                    : `on ${view.dayHeading}`
                }`}
                message={
                  view.next
                    ? `Your next class is ${view.next.dayLabel} at ${view.next.startTimeLabel}.`
                    : 'Nothing is scheduled.'
                }
              />
            ) : (
              <Stack gap="md" align="stretch">
                {view.timeline.map((entry, index) => (
                  <Entrance
                    key={entry.session.id}
                    delay={80 + index * 50}
                    distance={6}
                  >
                    <ClassTimelineItem
                      entry={entry}
                      durationLabel={entry.durationLabel}
                      progress={entry.progress}
                      accessibilityLabel={scheduleItemLabel(entry)}
                    />
                  </Entrance>
                ))}
              </Stack>
            )}
          </Entrance>
        </Stack>
      </ScrollView>
    </Screen>
  );
}

function DayCell({
  day,
  onSelect,
}: {
  day: ScheduleDay;
  onSelect: (dateKey: string) => void;
}) {
  const { colors, radius, spacing } = useTheme();
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.94);

  const numberColor = day.isSelected
    ? 'accent'
    : day.classCount === 0
    ? 'muted'
    : 'primary';

  return (
    <AnimatedPressable
      accessibilityRole="radio"
      accessibilityState={{ selected: day.isSelected }}
      accessibilityLabel={day.accessibilityLabel}
      onPress={() => {
        haptics.light();
        onSelect(day.dateKey);
      }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[
        {
          flex: 1,
          minHeight: 64,
          borderRadius: radius.lg,
          backgroundColor: day.isSelected ? colors.accentTint : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: spacing.sm,
        },
        animatedStyle,
      ]}
    >
      <Text variant="metadata" color={day.isSelected ? 'accent' : 'muted'}>
        {day.weekdayShort}
      </Text>
      <Text variant="title" color={numberColor} style={{ marginTop: 2 }}>
        {`${day.dayNumber}`}
      </Text>
      <View
        style={{
          width: 4,
          height: 4,
          borderRadius: 2,
          marginTop: 4,
          backgroundColor: day.isToday ? colors.accent : 'transparent',
        }}
      />
    </AnimatedPressable>
  );
}

function scheduleItemLabel(entry: {
  courseTitle: string;
  startTimeLabel: string;
  endTimeLabel: string;
  room?: string;
  instructor?: string;
  status: string;
}): string {
  const room = entry.room ? `, ${entry.room}` : '';
  const instructor = entry.instructor ? `, ${entry.instructor}` : '';
  const state =
    entry.status === 'current'
      ? 'happening now'
      : entry.status === 'completed'
      ? 'completed'
      : 'upcoming';
  return `${entry.courseTitle}, ${entry.startTimeLabel} to ${entry.endTimeLabel}${room}${instructor}, ${state}`;
}

function ScheduleSkeleton() {
  const { spacing } = useTheme();

  return (
    <Screen>
      <Stack gap="lg" align="stretch" style={{ paddingTop: spacing.xl }}>
        <Skeleton height={46} radius="lg" accessibilityLabel="Loading week" />
        <Row gap="sm" align="center">
          {Array.from({ length: 7 }, (_, index) => (
            <Skeleton
              key={index}
              height={64}
              radius="lg"
              style={{ flex: 1 }}
              accessibilityLabel="Loading day"
            />
          ))}
        </Row>
        <Skeleton
          width="40%"
          height={30}
          radius="md"
          accessibilityLabel="Loading heading"
        />
        <Skeleton
          height={72}
          radius="lg"
          accessibilityLabel="Loading classes"
        />
        <Skeleton
          height={72}
          radius="lg"
          accessibilityLabel="Loading classes"
        />
        <Skeleton
          height={72}
          radius="lg"
          accessibilityLabel="Loading classes"
        />
      </Stack>
    </Screen>
  );
}
