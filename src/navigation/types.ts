import type { LucideIcon } from 'lucide-react-native';
import {
  CalendarDays,
  ChartColumn,
  ClipboardCheck,
  House,
  Settings,
} from 'lucide-react-native';

/**
 * Route definitions.
 * - `Main` hosts the five primary destinations (bottom tabs).
 * - `DesignSystem` is a temporary development screen (Stage 2 verification).
 */
export type MainTabParamList = {
  Home: undefined;
  Schedule: undefined;
  Attendance: undefined;
  Statistics: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Main: undefined;
  DesignSystem: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

/** Iconography + wording for the primary destinations (single source). */
export const TAB_DESTINATIONS: ReadonlyArray<{
  name: keyof MainTabParamList;
  label: string;
  icon: LucideIcon;
}> = [
  { name: 'Home', label: 'Home', icon: House },
  { name: 'Schedule', label: 'Schedule', icon: CalendarDays },
  { name: 'Attendance', label: 'Attendance', icon: ClipboardCheck },
  { name: 'Statistics', label: 'Stats', icon: ChartColumn },
  { name: 'Settings', label: 'Settings', icon: Settings },
];
