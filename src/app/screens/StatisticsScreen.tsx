import { ChartColumn } from 'lucide-react-native';
import { EmptyState, Screen, Stack, Text } from '../../components';
import { useTheme } from '../../design';

/** Stage 2 placeholder. Attendance analytics arrive in a later stage. */
export function StatisticsScreen() {
  const { spacing } = useTheme();

  return (
    <Screen>
      <Stack style={{ flex: 1, paddingTop: spacing.xl }}>
        <Text variant="heading">Stats</Text>
        <Stack gap={0} style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon={ChartColumn}
            title="Statistics are on their way"
            message="Daily, weekly and course-level insights arrive once attendance data exists."
          />
        </Stack>
      </Stack>
    </Screen>
  );
}
