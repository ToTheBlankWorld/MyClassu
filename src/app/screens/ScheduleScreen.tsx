import { CalendarDays } from 'lucide-react-native';
import { EmptyState, Screen, Stack, Text } from '../../components';
import { useTheme } from '../../design';

/**
 * Stage 2 placeholder. The weekly timetable UI (day pager, session cards,
 * gesture-driven day switching) is a dedicated later stage.
 */
export function ScheduleScreen() {
  const { spacing } = useTheme();

  return (
    <Screen>
      <Stack style={{ flex: 1, paddingTop: spacing.xl }}>
        <Text variant="heading">Schedule</Text>
        <Stack gap={0} style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon={CalendarDays}
            title="Timetable UI is on its way"
            message="The full weekly schedule ships in an upcoming stage. The typed timetable data is already loaded and tested."
          />
        </Stack>
      </Stack>
    </Screen>
  );
}
