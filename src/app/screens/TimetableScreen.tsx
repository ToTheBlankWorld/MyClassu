import React, { useMemo } from 'react';
import { Alert, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CalendarDays, Plus, Trash2 } from 'lucide-react-native';
import { Entrance, useTheme } from '../../design';
import {
  Button,
  EmptyState,
  IconButton,
  Row,
  Screen,
  SectionHeader,
  Stack,
  Text,
} from '../../components';
import { WEEKDAYS, type Weekday } from '../../domain/models';
import {
  commitTimetable,
  deleteSession,
  getActiveTimetable,
  useActiveTimetable,
} from '../../features/timetable/service/timetableStore';
import type { RootStackParamList } from '../../navigation/types';

type TimetableScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'Timetable'
>;

const WEEKDAY_LABELS: Record<Weekday, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

/**
 * Timetable management: sessions grouped Monday-first with add/edit and
 * confirmed delete. Every mutation commits through the single timetable
 * store, so Home, Schedule, stats, and the alarm resync follow together.
 * Attendance history lives in a separate store and is never touched here.
 */
export function TimetableScreen({ navigation }: TimetableScreenProps) {
  const { spacing } = useTheme();
  const { timetable } = useActiveTimetable();

  const groups = useMemo(
    () =>
      WEEKDAYS.map(weekday => ({
        weekday,
        sessions: timetable.sessions
          .filter(session => session.weekday === weekday)
          .sort((a, b) => (a.startTime < b.startTime ? -1 : 1)),
      })),
    [timetable],
  );

  const confirmDelete = (sessionId: string, label: string) => {
    Alert.alert(
      'Delete this class?',
      `${label} will stop appearing in your schedule and its future reminders will be cancelled. Past attendance records are kept.`,
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // Read the latest timetable at press time, not render time.
            commitTimetable(
              deleteSession(getActiveTimetable(), sessionId),
            ).catch(() => undefined);
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Stack
          gap="lg"
          style={{ paddingTop: spacing.lg, paddingBottom: spacing.xl }}
        >
          <Entrance delay={0}>
            <Row justify="between" align="center">
              <Stack gap={2} align="start">
                <Text variant="metadata" color="muted">
                  {'TIMETABLE'}
                </Text>
                <Text variant="headingLarge">{'Classes'}</Text>
              </Stack>
              <IconButton
                glyph={Plus}
                label="Add a class"
                onPress={() => navigation.navigate('SessionEditor', {})}
              />
            </Row>
          </Entrance>

          {groups.map(({ weekday, sessions }) => (
            <Stack key={weekday} gap="md" align="stretch">
              <SectionHeader
                title={WEEKDAY_LABELS[weekday]}
                action={
                  <Text variant="caption" color="muted">
                    {sessions.length === 0
                      ? 'no classes'
                      : `${sessions.length} ${
                          sessions.length === 1 ? 'class' : 'classes'
                        }`}
                  </Text>
                }
              />
              {sessions.length === 0 ? (
                <Text variant="caption" color="muted">
                  {'Nothing scheduled.'}
                </Text>
              ) : (
                sessions.map(session => {
                  const course = timetable.courses.find(
                    c => c.id === session.courseId,
                  );
                  const label = `${course?.title ?? session.courseId} · ${
                    session.startTime
                  }–${session.endTime}`;
                  return (
                    <Row key={session.id} gap="md" align="center">
                      <Stack gap={2} align="start" style={{ flex: 1 }}>
                        <Text variant="title">
                          {course?.title ?? session.courseId}
                        </Text>
                        <Text variant="caption" color="secondary">
                          {`${course?.code ?? ''} · ${session.startTime} – ${
                            session.endTime
                          }${session.room ? ` · ${session.room}` : ''}`}
                        </Text>
                      </Stack>
                      <Button
                        variant="tertiary"
                        size="sm"
                        onPress={() =>
                          navigation.navigate('SessionEditor', {
                            sessionId: session.id,
                          })
                        }
                      >
                        {'Edit'}
                      </Button>
                      <IconButton
                        glyph={Trash2}
                        label={`Delete ${label}`}
                        size="sm"
                        tone="destructive"
                        haptic={false}
                        onPress={() => confirmDelete(session.id, label)}
                      />
                    </Row>
                  );
                })
              )}
            </Stack>
          ))}

          <Entrance delay={120}>
            <Stack gap="sm" align="stretch">
              <EmptyState
                icon={CalendarDays}
                title="Edits update everything"
                message="Saving here refreshes Home, Schedule, statistics, and your upcoming reminders and class-start alarms."
              />
            </Stack>
          </Entrance>
        </Stack>
      </ScrollView>
    </Screen>
  );
}
