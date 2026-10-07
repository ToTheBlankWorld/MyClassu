import { ClipboardCheck } from 'lucide-react-native';
import { EmptyState, Screen, Stack, Text } from '../../components';
import { useTheme } from '../../design';

/** Stage 2 placeholder. Attendance marking arrives in a later stage. */
export function AttendanceScreen() {
  const { spacing } = useTheme();

  return (
    <Screen>
      <Stack style={{ flex: 1, paddingTop: spacing.xl }}>
        <Text variant="heading">Attendance</Text>
        <Stack gap={0} style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon={ClipboardCheck}
            title="Attendance tracking is on its way"
            message="One-tap attendance with skip reasons arrives in an upcoming stage."
          />
        </Stack>
      </Stack>
    </Screen>
  );
}
