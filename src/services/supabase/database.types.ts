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
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey';
            columns: ['id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'courses_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'class_sessions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'class_sessions_course_id_fkey';
            columns: ['course_id'];
            isOneToOne: false;
            referencedRelation: 'courses';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'attendance_records_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attendance_records_class_session_id_fkey';
            columns: ['class_session_id'];
            isOneToOne: false;
            referencedRelation: 'class_sessions';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'skip_reasons_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'notification_settings_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'email_settings_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
