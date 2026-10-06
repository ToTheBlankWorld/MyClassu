/**
 * Route definitions for the root stack. Add new routes here; screens declare
 * their params so navigation calls stay type-checked.
 */
export type RootStackParamList = {
  Home: undefined;
  Schedule: undefined;
  Settings: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
