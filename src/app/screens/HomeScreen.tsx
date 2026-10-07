import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Screen, Stack, Text, useToast } from '../../components';
import { Entrance, useTheme } from '../../design';
import type {
  MainTabParamList,
  RootStackParamList,
} from '../../navigation/types';

type HomeScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

/**
 * Stage 2 shell. The real Home experience ("now / next" class, attendance
 * state) is a later stage; this verifies navigation and the design system.
 */
export function HomeScreen({ navigation }: HomeScreenProps) {
  const { showToast } = useToast();
  const { spacing } = useTheme();

  return (
    <Screen>
      <Entrance style={{ flex: 1, paddingTop: spacing.xxl }}>
        <Text variant="metadata" color="muted">
          STAGE 2 · APP SHELL
        </Text>
        <Text variant="display" style={{ marginTop: spacing.sm }}>
          MyClassu
        </Text>
        <Text
          variant="body"
          color="secondary"
          style={{ marginTop: spacing.md, maxWidth: 420 }}
        >
          Your classes, reminders and attendance in one calm place. The shell is
          in place — schedule, alarms and attendance arrive stage by stage.
        </Text>
        <Stack gap="lg" style={{ marginTop: spacing.xxl }}>
          <Button block onPress={() => navigation.navigate('Schedule')}>
            Open the schedule
          </Button>
          <Button
            block
            variant="secondary"
            onPress={() => navigation.navigate('Settings')}
          >
            Settings
          </Button>
          <Button
            block
            variant="tertiary"
            onPress={() =>
              showToast({
                title: 'Attendance recorded',
                message: 'This is what a confirmation feels like.',
                tone: 'success',
              })
            }
          >
            Preview a confirmation
          </Button>
          <Button
            block
            variant="tertiary"
            onPress={() =>
              showToast({
                title: 'Unable to sync',
                message: 'Your data is safe locally — we will retry later.',
                tone: 'error',
                action: { label: 'Retry', onPress: () => undefined },
              })
            }
          >
            Preview an error with action
          </Button>
          <Button
            block
            variant="tertiary"
            onPress={() => navigation.navigate('DesignSystem')}
          >
            Design system showcase
          </Button>
        </Stack>
      </Entrance>
    </Screen>
  );
}
