import { ScheduleView } from './ScheduleView';
import { useSchedule } from '../../features/timetable/useSchedule';

/**
 * The MyClassu Schedule experience: week strip, selected-day timeline with
 * schedule states, and intentional empty days. Data comes exclusively from
 * the timetable engine through the schedule selector; `useSchedule` owns
 * the selected date, week navigation and a coarse live clock so the running
 * class stays honest without a per-second render loop.
 */
export function ScheduleScreen() {
  const { status, view, actions, retry } = useSchedule();

  return (
    <ScheduleView
      status={status}
      view={view}
      actions={actions}
      onRetry={retry}
    />
  );
}
