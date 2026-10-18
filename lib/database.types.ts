/**
 * Typed Supabase Database interface.
 *
 * These types mirror the SQL schema in `supabase/migrations/0001_init.sql`.
 * They power `createClient<Database>` so every query is statically checked
 * against the real shape of the tables.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type MonitorStatus =
  | "operational"
  | "degraded"
  | "down"
  | "paused";

export type CheckInterval = "30s" | "1m" | "5m" | "15m" | "1h";

export type Database = {
  public: {
    Tables: {
      monitors: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          url: string;
          interval: CheckInterval;
          status: MonitorStatus;
          last_latency_ms: number | null;
          is_paused: boolean;
          ssl_expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          url: string;
          interval?: CheckInterval;
          status?: MonitorStatus;
          last_latency_ms?: number | null;
          is_paused?: boolean;
          ssl_expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          url?: string;
          interval?: CheckInterval;
          status?: MonitorStatus;
          last_latency_ms?: number | null;
          is_paused?: boolean;
          ssl_expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      check_logs: {
        Row: {
          id: string;
          monitor_id: string;
          status_code: number;
          latency_ms: number;
          location: string;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          monitor_id: string;
          status_code: number;
          latency_ms: number;
          location: string;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          monitor_id?: string;
          status_code?: number;
          latency_ms?: number;
          location?: string;
          error_message?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      public_status_pages: {
        Row: {
          id: string;
          user_id: string;
          slug: string;
          title: string;
          is_live: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          slug: string;
          title?: string;
          is_live?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          slug?: string;
          title?: string;
          is_live?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      monitor_status: MonitorStatus;
      check_interval: CheckInterval;
    };
    CompositeTypes: Record<string, never>;
  };
};
