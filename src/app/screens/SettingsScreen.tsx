import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Moon, Monitor, Sun } from 'lucide-react-native';
import {
  Button,
  Chip,
  Row,
  Screen,
  SectionHeader,
  Stack,
  Text,
  useToast,
} from '../../components';
import { useTheme, useThemePreference } from '../../design';
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
 * Settings shell. Appearance is real, working functionality from Stage 2;
 * reminder/alarm/report preferences arrive in later stages.
 */
export function SettingsScreen({ navigation }: SettingsScreenProps) {
  const { spacing } = useTheme();
  const { preference, setPreference } = useThemePreference();

  return (
    <Screen>
      <Stack style={{ flex: 1, paddingTop: spacing.xl }}>
        <Text variant="heading">Settings</Text>
        <Stack gap="lg" style={{ marginTop: spacing.xl }}>
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
          <Text variant="caption" color="muted">
            Light and dark are carefully layered �?" dark mode is not simply
            black and white.
          </Text>
        </Stack>
        <Stack gap="lg" style={{ marginTop: spacing.xxl }}>
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
    </Screen>
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

  const cancelAll = async () => {
    try {
      const { cancelAllReminders, cancelTestReminder, cancelTestClassStart } =
        await import('../../features/reminders/reminderBridge');
      const result = await cancelAllReminders();
      // The one-shot test alarms use different action identities, so they
      // are not part of the class set — cancel them explicitly. Debug only.
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
