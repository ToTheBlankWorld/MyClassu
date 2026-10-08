import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNow } from '../../hooks/useNow';
import type { ScheduleView } from './schedule';
import { buildScheduleView } from './schedule';
import { addDays } from '../../utils/time';

/**
 * Schedule screen data container: owns the selected local date + week
 * navigation, drives the pure schedule selector from a live `now` instant,
 * and exposes a status machine for loading / ready / error presentations.
 * The bundled timetable loads synchronously; Supabase is never involved.
 */

export type ScheduleLoadStatus = 'loading' | 'ready' | 'error';

export interface ScheduleActions {
  selectDay: (dateKey: string) => void;
  previousWeek: () => void;
  nextWeek: () => void;
  goToToday: () => void;
}

export interface UseScheduleResult {
  status: ScheduleLoadStatus;
  view: ScheduleView | null;
  actions: ScheduleActions;
  retry: () => void;
}

export function useSchedule(): UseScheduleResult {
  const now = useNow();
  const [status, setStatus] = useState<ScheduleLoadStatus>('loading');
  const [view, setView] = useState<ScheduleView | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  /** Last Asia/Kolkata today seen — anchors week shifts while unselected. */
  const todayKeyRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      const built = buildScheduleView(now, selectedKey);
      todayKeyRef.current = built.todayKey;
      setView(built);
      setStatus('ready');
    } catch {
      // Malformed timetable data or date key — retryable error, no crash.
      setView(null);
      setStatus('error');
    }
  }, [now, selectedKey, attempt]);

  const selectDay = useCallback((dateKey: string) => {
    setSelectedKey(dateKey);
  }, []);

  const previousWeek = useCallback(() => {
    const anchor = todayKeyRef.current;
    if (!anchor) {
      return;
    }
    setSelectedKey(previous => addDays(previous ?? anchor, -7));
  }, []);

  const nextWeek = useCallback(() => {
    const anchor = todayKeyRef.current;
    if (!anchor) {
      return;
    }
    setSelectedKey(previous => addDays(previous ?? anchor, 7));
  }, []);

  const goToToday = useCallback(() => {
    setSelectedKey(null);
  }, []);

  const retry = useCallback(() => {
    setAttempt(previous => previous + 1);
  }, []);

  const actions = useMemo(
    () => ({ selectDay, previousWeek, nextWeek, goToToday }),
    [selectDay, previousWeek, nextWeek, goToToday],
  );

  return { status, view, actions, retry };
}
