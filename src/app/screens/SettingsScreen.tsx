import { EmptyState, Screen, Stack, Text } from '../../components';
import { useTheme } from '../../design';

/**
 * Stage 0 placeholder. Reminders, alarms and report preferences live here in
 * a later stage.
 */
export function SettingsScreen() {
  const { spacing } = useTheme();

  return (
    <Screen>
      <Stack style={{ flex: 1, paddingTop: spacing.xl }}>
        <Text variant="heading">Settings</Text>
        <Stack gap={0} style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            glyph="⚙"
            title="Nothing to tune yet"
            message="Reminder timing, alarms and reports become configurable in an upcoming stage."
          />
        </Stack>
      </Stack>
    </Screen>
  );
}
