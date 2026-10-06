import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../app/screens/HomeScreen';
import { ScheduleScreen } from '../app/screens/ScheduleScreen';
import { SettingsScreen } from '../app/screens/SettingsScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Root navigation. Stage 0 ships a minimal shell; feature-owned screens and a
 * bottom-tab topology plug in here during later stages.
 */
export function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Schedule" component={ScheduleScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}
