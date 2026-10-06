import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Screen, Stack, Text, useToast } from '../../components';
import { useTheme } from '../../design';
import type { RootStackParamList } from '../../navigation/types';

type HomeNavigation = NativeStackNavigationProp<RootStackParamList, 'Home'>;

/**
 * Stage 0 placeholder shell. The real Home experience ("now / next" class,
 * attendance state) is built in a later stage.
 */
export function HomeScreen() {
  const navigation = useNavigation<HomeNavigation>();
  const { showToast } = useToast();
  const { spacing } = useTheme();

  return (
    <Screen>
      <Stack style={{ flex: 1, paddingTop: spacing.xxxl }}>
        <Text variant="metadata" color="muted">
          STAGE 0 · FOUNDATION
        </Text>
        <Text variant="display" style={{ marginTop: spacing.sm }}>
          MyClassu
        </Text>
        <Text
          variant="body"
          color="secondary"
          style={{ marginTop: spacing.md, maxWidth: 420 }}
        >
          Your classes, reminders and attendance in one calm place. The
          foundation is in place — schedule, alarms and attendance arrive stage
          by stage.
        </Text>
        <Stack gap="lg" style={{ marginTop: spacing.xxl }}>
          <Button
            block
            variant="primary"
            onPress={() => navigation.navigate('Schedule')}
          >
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
            variant="ghost"
            onPress={() =>
              showToast({
                message:
                  'Foundation ready — reminders arrive in a later stage.',
                tone: 'accent',
              })
            }
          >
            Preview an in-app notification
          </Button>
        </Stack>
      </Stack>
    </Screen>
  );
}
