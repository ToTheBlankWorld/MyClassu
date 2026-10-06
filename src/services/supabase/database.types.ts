import type { AttendanceStatus, Weekday } from '../../domain/models';

/**
 * TypeScript contract for the Supabase schema (see supabase/migrations).
 * Hand-maintained to mirror the SQL migrations; keep both in sync when the
 * schema evolves (a structural test in supabase/migrations guards the
 * table set).
 */

export type DbWeekday = Weekday;
export type DbAttendanceStatus = AttendanceStatus;

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          display_name?: string | null;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      courses: {
        Row: {
          id: string;
          user_id: string;
          code: string;
          title: string;
          instructor: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          code: string;
          title: string;
          instructor?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          code?: string;
          title?: string;
          instructor?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      class_sessions: {
        Row: {
          id: string;
          user_id: string;
          course_id: string;
          weekday: DbWeekday;
          start_time: string;
          end_time: string;
          room: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          course_id: string;
          weekday: DbWeekday;
          start_time: string;
          end_time: string;
          room?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          course_id?: string;
          weekday?: DbWeekday;
          start_time?: string;
          end_time?: string;
          room?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      attendance_records: {
        Row: {
          id: string;
          user_id: string;
          class_session_id: string;
          date: string;
          status: DbAttendanceStatus;
          reason_category: string | null;
          reason_text: string | null;
          marked_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          class_session_id: string;
          date: string;
          status: DbAttendanceStatus;
          reason_category?: string | null;
          reason_text?: string | null;
          marked_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          class_session_id?: string;
          date?: string;
          status?: DbAttendanceStatus;
          reason_category?: string | null;
          reason_text?: string | null;
          marked_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      skip_reasons: {
        Row: {
          id: string;
          user_id: string | null;
          name: string;
          icon: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          name: string;
          icon?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          name?: string;
          icon?: string | null;
          created_at?: string;
        };
      };
      notification_settings: {
        Row: {
          user_id: string;
          reminder_minutes: number;
          alarm_enabled: boolean;
          sound_enabled: boolean;
          haptics_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          reminder_minutes?: number;
          alarm_enabled?: boolean;
          sound_enabled?: boolean;
          haptics_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          reminder_minutes?: number;
          alarm_enabled?: boolean;
          sound_enabled?: boolean;
          haptics_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      email_settings: {
        Row: {
          user_id: string;
          enabled: boolean;
          report_time: string;
          email_address: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          enabled?: boolean;
          report_time?: string;
          email_address?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          enabled?: boolean;
          report_time?: string;
          email_address?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
