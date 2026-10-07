import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DesignSystemShowcaseScreen } from '../app/screens/DesignSystemShowcaseScreen';
import { AttendanceScreen } from '../app/screens/AttendanceScreen';
import { HomeScreen } from '../app/screens/HomeScreen';
import { ScheduleScreen } from '../app/screens/ScheduleScreen';
import { SettingsScreen } from '../app/screens/SettingsScreen';
import { StatisticsScreen } from '../app/screens/StatisticsScreen';
import { TabBar } from './TabBar';
import type { MainTabParamList, RootStackParamList } from './types';

const Tabs = createBottomTabNavigator<MainTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

function MainTabs() {
  return (
    <Tabs.Navigator
      tabBar={props => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen name="Schedule" component={ScheduleScreen} />
      <Tabs.Screen name="Attendance" component={AttendanceScreen} />
      <Tabs.Screen name="Statistics" component={StatisticsScreen} />
      <Tabs.Screen name="Settings" component={SettingsScreen} />
    </Tabs.Navigator>
  );
}

/**
 * Root navigation. Primary destinations live in the tab shell; detail and
 * temporary screens push on top of it. Main destination changes are handled
 * by the tab shell itself (instant, native); detail screens use the
 * platform forward-push; the showcase opens as a bottom slide.
 */
export function RootNavigator() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="Main" component={MainTabs} />
      <RootStack.Screen
        name="DesignSystem"
        component={DesignSystemShowcaseScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
    </RootStack.Navigator>
  );
}
