import React from 'react';
import { ScrollView } from 'react-native';
import { CalendarDays, MapPin, User } from 'lucide-react-native';
import {
  Badge,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  Icon,
  ProgressIndicator,
  Row,
  Screen,
  SectionHeader,
  Skeleton,
  Stack,
  Text,
} from '../../components';
import { Entrance, useTheme } from '../../design';
import { ClassTimelineItem } from '../../features/timetable/components/ClassTimelineItem';
import type { HomeDashboard } from '../../features/timetable/dashboard';

export type HomeStatus = 'loading' | 'ready' | 'error';

export interface HomeViewProps {
  status: HomeStatus;
  dashboard: HomeDashboard | null;
  onRetry: () => void;
}

/**
 * Presentational Home screen: answers "what is happening now / what is next /
 * how does my day look" from the dashboard data, with skeleton, error and
 * empty presentations. All data comes from the timetable engine — nothing
 * here computes schedule state itself.
 */
export function HomeView({ status, dashboard, onRetry }: HomeViewProps) {
  if (status === 'loading') {
    return <HomeSkeleton />;
  }
  if (status === 'error' || !dashboard) {
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
  return <HomeContent dashboard={dashboard} />;
}

function HomeContent({ dashboard }: { dashboard: HomeDashboard }) {
  const { spacing } = useTheme();

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
                {dashboard.dateLabel.toUpperCase()} · {dashboard.classesToday}{' '}
                {dashboard.classesToday === 1 ? 'CLASS' : 'CLASSES'}
              </Text>
              <Text variant="headingLarge">{dashboard.heading}</Text>
              <Text variant="bodySmall" color="secondary">
                {dashboard.summary}
              </Text>
            </Stack>
          </Entrance>

          <Entrance delay={60}>
            <HeroCard dashboard={dashboard} />
          </Entrance>

          <Entrance delay={120}>
            <Stack gap="md" align="stretch">
              <SectionHeader
                title="Today"
                action={
                  <Text variant="caption" color="muted">
                    {dashboard.classesToday}{' '}
                    {dashboard.classesToday === 1 ? 'class' : 'classes'}
                  </Text>
                }
              />
              {dashboard.timeline.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  title="No classes today"
                  message={
                    dashboard.next
                      ? `Your next class is ${dashboard.next.dayLabel} at ${dashboard.next.startTimeLabel}.`
                      : 'Nothing is scheduled for the rest of the week.'
                  }
                />
              ) : (
                <Stack gap="md" align="stretch">
                  {dashboard.timeline.map((entry, index) => (
                    <Entrance key={entry.session.id} delay={150 + index * 60}>
                      <ClassTimelineItem entry={entry} />
                    </Entrance>
                  ))}
                </Stack>
              )}
            </Stack>
          </Entrance>

          {dashboard.upcomingPreview.length > 0 ? (
            <Entrance delay={200}>
              <Stack gap="md" align="stretch">
                <SectionHeader title="Coming up" />
                <Stack gap="md" align="stretch">
                  {dashboard.upcomingPreview.map((entry, index) => (
                    <Stack
                      key={`${entry.dateKey}-${entry.sessionId}`}
                      gap={0}
                      align="stretch"
                    >
                      <Row gap="lg" align="start">
                        <Text
                          variant="label"
                          color="accent"
                          style={{ width: 88 }}
                        >
                          {entry.dayLabel}
                        </Text>
                        <Stack gap={2} align="start" style={{ flex: 1 }}>
                          <Text variant="title">{entry.courseTitle}</Text>
                          <Row
                            gap="sm"
                            align="center"
                            style={{ flexWrap: 'wrap' }}
                          >
                            <Text variant="caption" color="secondary">
                              {entry.courseCode} · {entry.startTimeLabel}
                            </Text>
                            {entry.room ? (
                              <Row gap={4} align="center">
                                <Icon glyph={MapPin} size="xs" color="muted" />
                                <Text variant="caption" color="muted">
                                  {entry.room}
                                </Text>
                              </Row>
                            ) : null}
                          </Row>
                        </Stack>
                      </Row>
                      {index < dashboard.upcomingPreview.length - 1 ? (
                        <Divider style={{ marginTop: spacing.md }} />
                      ) : null}
                    </Stack>
                  ))}
                </Stack>
              </Stack>
            </Entrance>
          ) : null}
        </Stack>
      </ScrollView>
    </Screen>
  );
}

function HeroCard({ dashboard }: { dashboard: HomeDashboard }) {
  const { spacing } = useTheme();

  const stateKey = dashboard.current
    ? `now-${dashboard.current.courseCode}-${dashboard.current.startMinutes}`
    : dashboard.next
    ? `next-${dashboard.next.courseCode}-${dashboard.next.dateKey}`
    : 'empty';

  return (
    <Card
      level="base"
      style={{ padding: spacing.xl }}
      accessibilityLabel={heroAccessibilityLabel(dashboard)}
    >
      <Entrance key={stateKey} from="bottom" distance={8}>
        {dashboard.current ? (
          <HeroCurrent
            courseTitle={dashboard.current.courseTitle}
            courseCode={dashboard.current.courseCode}
            room={dashboard.current.room}
            instructor={dashboard.current.instructor}
            startTimeLabel={dashboard.current.startTimeLabel}
            endTimeLabel={dashboard.current.endTimeLabel}
            minutesRemaining={dashboard.current.minutesRemaining}
            progress={dashboard.current.progress}
          />
        ) : dashboard.next ? (
          <HeroNext
            courseTitle={dashboard.next.courseTitle}
            courseCode={dashboard.next.courseCode}
            room={dashboard.next.room}
            instructor={dashboard.next.instructor}
            startTimeLabel={dashboard.next.startTimeLabel}
            minutesUntil={dashboard.next.minutesUntil}
            dayLabel={dashboard.next.dayLabel}
          />
        ) : null}
      </Entrance>
    </Card>
  );
}

interface HeroClassProps {
  courseTitle: string;
  courseCode: string;
  room?: string;
  instructor?: string;
}

function MetaRows({
  room,
  instructor,
}: Pick<HeroClassProps, 'room' | 'instructor'>) {
  const { spacing } = useTheme();

  return (
    <Stack gap="sm" align="start" style={{ marginTop: spacing.md }}>
      {room ? (
        <Row gap="sm" align="center">
          <Icon glyph={MapPin} size="sm" color="secondary" />
          <Text variant="bodySmall" color="secondary">
            {room}
          </Text>
        </Row>
      ) : null}
      {instructor ? (
        <Row gap="sm" align="center">
          <Icon glyph={User} size="sm" color="secondary" />
          <Text variant="bodySmall" color="secondary">
            {instructor}
          </Text>
        </Row>
      ) : null}
    </Stack>
  );
}

function HeroCurrent({
  courseTitle,
  courseCode,
  room,
  instructor,
  startTimeLabel,
  endTimeLabel,
  minutesRemaining,
  progress,
}: HeroClassProps & {
  startTimeLabel: string;
  endTimeLabel: string;
  minutesRemaining: number;
  progress: number;
}) {
  const { spacing } = useTheme();

  return (
    <Stack gap="sm" align="stretch">
      <Row justify="between" align="center">
        <Badge tone="success">NOW</Badge>
        <Text variant="caption" color="muted">
          {`${startTimeLabel} – ${endTimeLabel}`}
        </Text>
      </Row>
      <Text variant="headingLarge" style={{ marginTop: spacing.xs }}>
        {courseTitle}
      </Text>
      <Text variant="bodySmall" color="secondary">
        {courseCode}
      </Text>
      <Stack gap="md" align="stretch" style={{ marginTop: spacing.sm }}>
        <ProgressIndicator
          value={progress}
          accessibilityLabel="Progress through the class"
        />
        <Text variant="label" color="accent">
          {`${formatRemaining(minutesRemaining)} remaining`}
        </Text>
      </Stack>
      <MetaRows room={room} instructor={instructor} />
    </Stack>
  );
}

function HeroNext({
  courseTitle,
  courseCode,
  room,
  instructor,
  startTimeLabel,
  minutesUntil,
  dayLabel,
}: HeroClassProps & {
  startTimeLabel: string;
  minutesUntil: number;
  dayLabel: string;
}) {
  const { spacing } = useTheme();
  const isToday = dayLabel === 'Today';

  return (
    <Stack gap="sm" align="stretch">
      <Row justify="between" align="center">
        <Badge tone="accent">NEXT</Badge>
        <Text variant="caption" color="muted">
          {dayLabel.toUpperCase()}
        </Text>
      </Row>
      <Text variant="headingLarge" style={{ marginTop: spacing.xs }}>
        {courseTitle}
      </Text>
      <Text variant="bodySmall" color="secondary">
        {courseCode}
      </Text>
      <Stack gap={2} align="start" style={{ marginTop: spacing.xs }}>
        <Text variant="heading" color="accent">
          {`in ${formatRemaining(minutesUntil)}`}
        </Text>
        <Text variant="caption" color="muted">
          {`${isToday ? 'Today' : dayLabel} · starts at ${startTimeLabel}`}
        </Text>
      </Stack>
      <MetaRows room={room} instructor={instructor} />
    </Stack>
  );
}

function formatRemaining(minutes: number): string {
  if (minutes < 1) {
    return 'moments';
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) {
    return `${mins} min`;
  }
  return mins === 0 ? `${hours} h` : `${hours} h ${mins} min`;
}

function heroAccessibilityLabel(dashboard: HomeDashboard): string {
  if (dashboard.current) {
    const c = dashboard.current;
    const room = c.room ? `, room ${c.room}` : '';
    return `Happening now: ${c.courseTitle}, ${c.courseCode}, until ${
      c.endTimeLabel
    }${room}, ${formatRemaining(c.minutesRemaining)} remaining`;
  }
  if (dashboard.next) {
    const n = dashboard.next;
    const room = n.room ? `, room ${n.room}` : '';
    return `Next class: ${n.courseTitle}, ${n.courseCode}, ${n.dayLabel} at ${
      n.startTimeLabel
    }${room}, in ${formatRemaining(n.minutesUntil)}`;
  }
  return 'No classes scheduled';
}

function HomeSkeleton() {
  const { spacing } = useTheme();

  return (
    <Screen>
      <Stack gap="lg" align="stretch" style={{ paddingTop: spacing.xl }}>
        <Skeleton width="55%" height={12} accessibilityLabel="Loading date" />
        <Skeleton
          width="45%"
          height={30}
          radius="md"
          accessibilityLabel="Loading heading"
        />
        <Skeleton
          height={200}
          radius="xl"
          accessibilityLabel="Loading your class"
        />
        <Skeleton width="30%" height={12} style={{ marginTop: spacing.md }} />
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
