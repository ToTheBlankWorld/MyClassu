import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, EmptyState, Screen, Stack, Text } from '../../components';
import { useTheme } from '../../design';
import type { RootStackParamList } from '../../navigation/types';

type ScheduleNavigation = NativeStackNavigationProp<
  RootStackParamList,
  'Schedule'
>;

/**
 * Stage 0 placeholder. The weekly timetable UI (day pager, session cards,
 * gesture-driven day switching) is a dedicated later stage.
 */
export function ScheduleScreen() {
  const navigation = useNavigation<ScheduleNavigation>();
  const { spacing } = useTheme();

  return (
    <Screen>
      <Stack style={{ flex: 1, paddingTop: spacing.xl }}>
        <Text variant="heading">Schedule</Text>
        <Stack gap={0} style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            glyph="▦"
            title="Timetable UI is on its way"
            message="The full weekly schedule ships in an upcoming stage. The typed timetable data is already loaded and tested."
            action={
              <Button variant="secondary" onPress={() => navigation.goBack()}>
                Back home
              </Button>
            }
          />
        </Stack>
      </Stack>
    </Screen>
  );
}
