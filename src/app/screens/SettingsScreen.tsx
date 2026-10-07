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
            Light and dark are carefully layered — dark mode is not simply black
            and white.
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
        </Stack>
      </Stack>
    </Screen>
  );
}
