import React, { useMemo, useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Entrance, useTheme } from '../../design';
import {
  Button,
  Chip,
  Row,
  Screen,
  SectionHeader,
  Stack,
  Text,
  TextField,
} from '../../components';
import { WEEKDAYS, type Weekday } from '../../domain/models';
import {
  addCourse,
  addSession,
  commitTimetable,
  findOverlaps,
  getActiveTimetable,
  updateSession,
  validateSessionInput,
} from '../../features/timetable/service/timetableStore';
import type { RootStackParamList } from '../../navigation/types';

type SessionEditorProps = NativeStackScreenProps<
  RootStackParamList,
  'SessionEditor'
>;

const WEEKDAY_SHORT: Record<Weekday, string> = {
  monday: 'MON',
  tuesday: 'TUE',
  wednesday: 'WED',
  thursday: 'THU',
  friday: 'FRI',
  saturday: 'SAT',
  sunday: 'SUN',
};

const WEEKDAY_LABEL: Record<Weekday, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

/**
 * Add/edit form for one class session. Validates required fields and time
 * ranges inline; overlapping sessions produce a warning with an explicit
 * confirm-to-save-anyway step instead of a silent block. New courses can
 * be created inline (code + subject); rooms stay per-session.
 */
export function SessionEditorScreen({ navigation, route }: SessionEditorProps) {
  const { spacing } = useTheme();
  const sessionId = route.params?.sessionId;
  const existing = sessionId
    ? getActiveTimetable().sessions.find(session => session.id === sessionId)
    : undefined;

  const [courseId, setCourseId] = useState(existing?.courseId ?? '');
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [courseCode, setCourseCode] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [courseInstructor, setCourseInstructor] = useState('');
  const [weekday, setWeekday] = useState<Weekday>(
    existing?.weekday ?? 'monday',
  );
  const [startTime, setStartTime] = useState(existing?.startTime ?? '');
  const [endTime, setEndTime] = useState(existing?.endTime ?? '');
  const [room, setRoom] = useState(existing?.room ?? '');
  const [instructor, setInstructor] = useState(existing?.instructor ?? '');
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const courses = getActiveTimetable().courses;

  const overlaps = useMemo(
    () =>
      findOverlaps(
        getActiveTimetable(),
        weekday,
        startTime,
        endTime,
        sessionId,
      ),
    [weekday, startTime, endTime, sessionId],
  );

  const save = (allowOverlap: boolean) => {
    setErrors([]);
    try {
      let next = getActiveTimetable();
      let resolvedCourseId = courseId;
      if (creatingCourse) {
        const created = addCourse(next, {
          code: courseCode,
          title: courseTitle,
          instructor: courseInstructor,
        });
        next = created.timetable;
        resolvedCourseId = created.course.id;
      }
      const input = {
        courseId: resolvedCourseId,
        weekday,
        startTime: startTime.trim(),
        endTime: endTime.trim(),
        room,
        instructor,
      };
      const problems = validateSessionInput(next, input);
      if (problems.length > 0) {
        setErrors(problems);
        return;
      }
      if (!allowOverlap && overlaps.length > 0) {
        const names = overlaps
          .map(
            entry => `${entry.courseCode} ${entry.startTime}–${entry.endTime}`,
          )
          .join(', ');
        Alert.alert(
          'Overlapping class',
          `This overlaps with ${names}. Save anyway?`,
          [
            { text: 'Go back', style: 'cancel' },
            { text: 'Save anyway', onPress: () => save(true) },
          ],
        );
        return;
      }
      const updated = sessionId
        ? updateSession(next, sessionId, input)
        : addSession(next, input).timetable;
      setSaving(true);
      commitTimetable(updated)
        .then(() => navigation.goBack())
        .catch(() => {
          setSaving(false);
          setErrors(['Could not save — storage unavailable. Try again.']);
        });
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Could not save.']);
    }
  };

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Stack
          gap="lg"
          style={{ paddingTop: spacing.lg, paddingBottom: spacing.xl }}
        >
          <Entrance delay={0}>
            <Stack gap="xs" align="start">
              <Text variant="metadata" color="muted">
                {sessionId ? 'EDIT CLASS' : 'NEW CLASS'}
              </Text>
              <Text variant="headingLarge">
                {sessionId ? 'Edit class' : 'Add a class'}
              </Text>
            </Stack>
          </Entrance>

          <Stack gap="md" align="stretch">
            <SectionHeader title="Course" />
            <Row gap="sm" align="center" style={{ flexWrap: 'wrap' }}>
              {courses.map(course => (
                <Chip
                  key={course.id}
                  label={course.code}
                  selected={!creatingCourse && courseId === course.id}
                  onPress={() => {
                    setCreatingCourse(false);
                    setCourseId(course.id);
                  }}
                />
              ))}
              <Chip
                label="+ New"
                selected={creatingCourse}
                onPress={() => setCreatingCourse(true)}
              />
            </Row>
            {creatingCourse ? (
              <Stack gap="md" align="stretch">
                <TextField
                  label="Course code"
                  value={courseCode}
                  onChangeText={setCourseCode}
                  placeholder="CS9999"
                  autoCapitalize="characters"
                />
                <TextField
                  label="Subject"
                  value={courseTitle}
                  onChangeText={setCourseTitle}
                  placeholder="Subject name"
                />
                <TextField
                  label="Default faculty (optional)"
                  value={courseInstructor}
                  onChangeText={setCourseInstructor}
                  placeholder="Faculty name"
                />
              </Stack>
            ) : null}
          </Stack>

          <Stack gap="md" align="stretch">
            <SectionHeader title="Day" />
            <Row gap="sm" align="center" style={{ flexWrap: 'wrap' }}>
              {WEEKDAYS.map(day => (
                <Chip
                  key={day}
                  label={WEEKDAY_SHORT[day]}
                  selected={weekday === day}
                  onPress={() => setWeekday(day)}
                  accessibilityLabel={WEEKDAY_LABEL[day]}
                />
              ))}
            </Row>
          </Stack>

          <Stack gap="md" align="stretch">
            <SectionHeader title="Time" />
            <Row gap="md" align="start">
              <TextField
                label="Start (24h)"
                value={startTime}
                onChangeText={setStartTime}
                placeholder="14:00"
                keyboardType="numbers-and-punctuation"
                style={{ flex: 1 }}
              />
              <TextField
                label="End (24h)"
                value={endTime}
                onChangeText={setEndTime}
                placeholder="14:50"
                keyboardType="numbers-and-punctuation"
                style={{ flex: 1 }}
              />
            </Row>
          </Stack>

          <Stack gap="md" align="stretch">
            <SectionHeader title="Place & faculty" />
            <TextField
              label="Room (optional)"
              value={room}
              onChangeText={setRoom}
              placeholder="ICT / 305"
            />
            <TextField
              label="Faculty (optional)"
              value={instructor}
              onChangeText={setInstructor}
              placeholder="Faculty name"
            />
          </Stack>

          {overlaps.length > 0 ? (
            <Text variant="caption" color="warning">
              {`Overlaps with ${overlaps
                .map(
                  entry =>
                    `${entry.courseCode} ${entry.startTime}–${entry.endTime}`,
                )
                .join(', ')}. You will be asked to confirm.`}
            </Text>
          ) : null}

          {errors.length > 0 ? (
            <Stack gap="xs" align="start">
              {errors.map(message => (
                <Text key={message} variant="caption" color="danger">
                  {message}
                </Text>
              ))}
            </Stack>
          ) : null}

          <Button block loading={saving} onPress={() => save(false)}>
            {sessionId ? 'Save changes' : 'Add class'}
          </Button>
        </Stack>
      </ScrollView>
    </Screen>
  );
}
