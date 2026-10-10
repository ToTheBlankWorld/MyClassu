import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BellOff, Moon, Monitor, Sun } from 'lucide-react-native';
import {
  Button,
  Chip,
  EmptyState,
  Row,
  Screen,
  SectionHeader,
  Stack,
  SwitchRow,
  Text,
  useToast,
} from '../../components';
import { useTheme, useThemePreference } from '../../design';
import { useActiveTimetable } from '../../features/timetable/service/timetableStore';
import {
  canScheduleExactAlarms,
  getReminderPermissionStatus,
  openExactAlarmSettings,
  openNotificationSettings,
} from '../../features/reminders/reminderBridge';
import { useReminderPrefs } from '../../features/reminders/reminderPrefs';
import { syncClassReminders } from '../../features/reminders/useClassReminders';
import {
  TREND_WEEK_OPTIONS,
  useAttendancePrefs,
  type TrendWeeks,
} from '../../features/attendance/attendancePrefs';
import { useSyncStatus } from '../../features/attendance/useSyncStatus';
import type {
  MainTabParamList,
  RootStackParamList,
} from '../../navigation/types';

type SettingsScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Settings'>,
  NativeStackScreenProps<RootStackParamList>
>;

const THEME_OPTIONS = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
] as const;

/**
 * Settings: appearance, reminders, timetable, attendance display,
 * permissions, and cloud sync — every control performs a real action
 * against local stores or system pages. Offline-first throughout.
 */
export function SettingsScreen({ navigation }: SettingsScreenProps) {
  const { spacing } = useTheme();
  const { preference, setPreference } = useThemePreference();
  const { prefs: reminderPrefs, update: updateReminderPrefs } =
    useReminderPrefs();

  const updateReminders = (
    patch: Parameters<typeof updateReminderPrefs>[0],
  ) => {
    // Persist first, then resync alarms immediately (never blocking UI).
    updateReminderPrefs(patch)
      .then(() => syncClassReminders())
      .catch(() => undefined);
  };
  const { prefs: attendancePrefs, update: updateAttendancePrefs } =
    useAttendancePrefs();
  const { timetable } = useActiveTimetable();
  const sync = useSyncStatus();

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Stack
          gap="xl"
          style={{ paddingTop: spacing.lg, paddingBottom: spacing.xl }}
        >
          <Stack gap="xs" align="start">
            <Text variant="metadata" color="muted">
              {'SETTINGS'}
            </Text>
            <Text variant="headingLarge">{'Settings'}</Text>
          </Stack>

          <Stack gap="md" align="stretch">
            <SectionHeader title="Appearance" />
            <Row gap="sm">
              {THEME_OPTIONS.map(option => (
                <Chip
                  key={option.value}
                  label={option.label}
                  glyph={option.icon}
                  selected={preference === option.value}
                  onPress={() => setPreference(option.value)}
                />
              ))}
            </Row>
          </Stack>

          <Stack gap="md" align="stretch">
            <SectionHeader title="Reminders" />
            <SwitchRow
              label="5-minute reminders"
              description="A calm heads-up before each class starts."
              value={reminderPrefs.remindersEnabled}
              onValueChange={next =>
                updateReminders({ remindersEnabled: next })
              }
            />
            <SwitchRow
              label="Class-start alarms"
              description="Full-screen alert with sound at class time."
              value={reminderPrefs.classStartAlarmsEnabled}
              onValueChange={next =>
                updateReminders({ classStartAlarmsEnabled: next })
              }
            />
            <SwitchRow
              label="Alarm sound"
              description="Play the alarm ringtone (silent mode still vibrates)."
              value={reminderPrefs.soundEnabled}
              onValueChange={next => updateReminders({ soundEnabled: next })}
            />
            <SwitchRow
              label="Vibration"
              description="Vibrate for reminders and alarms."
              value={reminderPrefs.vibrationEnabled}
              onValueChange={next =>
                updateReminders({ vibrationEnabled: next })
              }
            />
            <Text variant="caption" color="muted">
              {
                'Reminders always fire 5 minutes early. Changes apply to future classes.'
              }
            </Text>
          </Stack>

          <Stack gap="md" align="stretch">
            <SectionHeader title="Timetable" />
            <Text variant="bodySmall" color="secondary">
              {`${timetable.sessions.length} classes across ${
                new Set(timetable.sessions.map(session => session.weekday)).size
              } days.`}
            </Text>
            <Button
              variant="secondary"
              onPress={() => navigation.navigate('Timetable')}
            >
              {'Manage timetable'}
            </Button>
          </Stack>

          <Stack gap="md" align="stretch">
            <SectionHeader title="Attendance display" />
            <Text variant="caption" color="secondary">
              {'Weeks shown in the Stats trend.'}
            </Text>
            <Row gap="sm">
              {TREND_WEEK_OPTIONS.map(weeks => (
                <Chip
                  key={weeks}
                  label={`${weeks} weeks`}
                  selected={attendancePrefs.trendWeeks === weeks}
                  onPress={() =>
                    updateAttendancePrefs({ trendWeeks: weeks as TrendWeeks })
                  }
                />
              ))}
            </Row>
          </Stack>

          <PermissionSection />
          <SyncSection
            configured={sync.configured}
            signedIn={sync.signedIn}
            pending={sync.pending}
            lastSummary={describeLastSync(sync.lastResult)}
          />

          <Stack gap="md" align="stretch">
            <SectionHeader title="Developer" />
            <Button
              variant="tertiary"
              onPress={() => navigation.navigate('DesignSystem')}
            >
              Design system showcase
            </Button>
            {__DEV__ ? <DeveloperReminderTools /> : null}
          </Stack>
        </Stack>
      </ScrollView>
    </Screen>
  );
}

function describeLastSync(
  lastResult: { synced: number; failed: number; atMillis: number } | null,
): string | null {
  if (!lastResult) {
    return null;
  }
  const date = new Date(lastResult.atMillis);
  return `Last attempt ${date.toLocaleString()}: ${
    lastResult.synced
  } uploaded, ${lastResult.failed} failed.`;
}

function PermissionSection() {
  const [notifications, setNotifications] = useState<
    'granted' | 'denied' | 'unknown'
  >('unknown');
  const [exact, setExact] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    getReminderPermissionStatus()
      .then(status => {
        if (!cancelled) {
          setNotifications(
            status === 'granted'
              ? 'granted'
              : status === 'denied'
              ? 'denied'
              : 'unknown',
          );
        }
      })
      .catch(() => undefined);
    canScheduleExactAlarms()
      .then(value => {
        if (!cancelled) {
          setExact(value);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Stack gap="md" align="stretch">
      <SectionHeader title="Permissions" />
      <PermissionRow
        label="Notifications"
        detail={
          notifications === 'granted'
            ? 'Allowed — reminders can appear.'
            : notifications === 'denied'
            ? 'Not allowed — you will not see reminders.'
            : 'Status unavailable on this device.'
        }
        actionLabel="Open settings"
        onAction={() => {
          openNotificationSettings().catch(() => undefined);
        }}
      />
      <PermissionRow
        label="Exact alarms"
        detail={
          exact === true
            ? 'Allowed — reminders fire at the exact minute.'
            : exact === false
            ? 'Not allowed — reminders may arrive late.'
            : 'Status unavailable on this device.'
        }
        actionLabel="Open settings"
        onAction={() => {
          openExactAlarmSettings().catch(() => undefined);
        }}
      />
      <Text variant="caption" color="muted">
        {
          'Full-screen alerts need no extra toggle on this device; if the system ever restricts them, the alarm still arrives as an ongoing notification.'
        }
      </Text>
    </Stack>
  );
}

function PermissionRow({
  label,
  detail,
  actionLabel,
  onAction,
}: {
  label: string;
  detail: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <Row gap="md" align="center">
      <Stack gap={2} align="start" style={{ flex: 1 }}>
        <Text variant="label">{label}</Text>
        <Text variant="caption" color="secondary">
          {detail}
        </Text>
      </Stack>
      <Button variant="tertiary" size="sm" onPress={onAction}>
        {actionLabel}
      </Button>
    </Row>
  );
}

function SyncSection({
  configured,
  signedIn,
  pending,
  lastSummary,
}: {
  configured: boolean;
  signedIn: boolean;
  pending: number;
  lastSummary: string | null;
}) {
  return (
    <Stack gap="md" align="stretch">
      <SectionHeader title="Cloud sync" />
      <StatusLine
        label="Supabase"
        value={configured ? 'Configured' : 'Not configured'}
      />
      <StatusLine
        label="Sign-in"
        value={signedIn ? 'Signed in' : 'Not signed in'}
      />
      <StatusLine
        label="Waiting upload"
        value={`${pending} record${pending === 1 ? '' : 's'}`}
      />
      {lastSummary ? (
        <Text variant="caption" color="secondary">
          {lastSummary}
        </Text>
      ) : null}
      {!configured || !signedIn ? (
        <EmptyState
          icon={BellOff}
          title="Local-first for now"
          message="Attendance is fully saved on this device. Cloud upload waits for sign-in and server session mapping — nothing is lost meanwhile."
        />
      ) : null}
    </Stack>
  );
}

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <Row justify="between" align="center">
      <Text variant="bodySmall" color="secondary">
        {label}
      </Text>
      <Text variant="label">{value}</Text>
    </Row>
  );
}

/**
 * Development-only reminder verification tools. Rendered exclusively in
 * __DEV__ bundles (stripped from release) and backed by debug-guarded
 * native methods (refused in release builds). Never a user-facing feature.
 */
function DeveloperReminderTools() {
  const { showToast } = useToast();

  const scheduleTest = async () => {
    try {
      const { scheduleTestReminder } = await import(
        '../../features/reminders/reminderBridge'
      );
      const result = await scheduleTestReminder(
        'Advanced Computer Networks',
        'Starts in 5 minutes',
        30,
      );
      showToast({
        title: result.scheduled
          ? 'Test reminder armed'
          : 'Test reminder failed',
        message: result.scheduled
          ? 'Fires in ~30 seconds — you can close the app.'
          : 'Check logcat for the native cause.',
        tone: result.scheduled ? 'success' : 'error',
      });
    } catch {
      showToast({
        title: 'Test reminder unavailable',
        message: 'The native reminder module is missing on this build.',
        tone: 'error',
      });
    }
  };

  const scheduleTestAlarm = async () => {
    try {
      const { scheduleTestClassStart } = await import(
        '../../features/reminders/reminderBridge'
      );
      const result = await scheduleTestClassStart(
        'Advanced Computer Networks',
        'CSEN3141',
        30,
      );
      showToast({
        title: result.scheduled
          ? 'Test class alarm armed'
          : 'Test alarm failed',
        message: result.scheduled
          ? 'Fires in ~30 seconds with full-screen intent.'
          : 'Check logcat for the native cause.',
        tone: result.scheduled ? 'success' : 'error',
      });
    } catch {
      showToast({
        title: 'Test alarm unavailable',
        message: 'The native reminder module is missing on this build.',
        tone: 'error',
      });
    }
  };

  const cancelTestAlarm = async () => {
    try {
      const { cancelTestClassStart } = await import(
        '../../features/reminders/reminderBridge'
      );
      const cancelled = await cancelTestClassStart();
      showToast({
        title: cancelled ? 'Test class alarm cancelled' : 'Nothing to cancel',
        message: 'The pending test class-start alarm was removed.',
        tone: 'success',
      });
    } catch {
      showToast({
        title: 'Cancellation unavailable',
        message: 'The native reminder module is missing on this build.',
        tone: 'error',
      });
    }
  };

  const cancelAll = async () => {
    try {
      const { cancelAllReminders, cancelTestReminder, cancelTestClassStart } =
        await import('../../features/reminders/reminderBridge');
      const result = await cancelAllReminders();
      try {
        await cancelTestReminder();
      } catch {
        // Test-alarm cleanup is best effort.
      }
      try {
        await cancelTestClassStart();
      } catch {
        // Test-alarm cleanup is best effort.
      }
      showToast({
        title: 'Reminders cancelled',
        message: `${result.cancelled} pending reminder(s) removed.`,
        tone: 'success',
      });
    } catch {
      showToast({
        title: 'Cancellation unavailable',
        message: 'The native reminder module is missing on this build.',
        tone: 'error',
      });
    }
  };

  return (
    <>
      <Button variant="tertiary" onPress={scheduleTest}>
        Schedule test reminder (30 s)
      </Button>
      <Button variant="tertiary" onPress={scheduleTestAlarm}>
        Schedule test class alarm (30 s)
      </Button>
      <Button variant="tertiary" onPress={cancelTestAlarm}>
        Cancel test class alarm
      </Button>
      <Button variant="tertiary" onPress={cancelAll}>
        Cancel all reminders
      </Button>
    </>
  );
}
