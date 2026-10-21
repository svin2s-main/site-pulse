/**
 * Typed Supabase Database interface.
 *
 * These types mirror the SQL schema in `supabase/migrations/0001_init.sql` and
 * `0002_alerts.sql`. They power `createClient<Database>` so every query is
 * statically checked against the real shape of the tables.
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

export type AlertEventType = "down" | "recovered" | "degraded";

export type AlertChannelType = "telegram";

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
          alerts_enabled: boolean;
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
          alerts_enabled?: boolean;
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
          alerts_enabled?: boolean;
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
      alert_channels: {
        Row: {
          id: string;
          user_id: string;
          type: AlertChannelType;
          telegram_chat_id: number;
          telegram_username: string | null;
          is_active: boolean;
          notify_degraded: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type?: AlertChannelType;
          telegram_chat_id: number;
          telegram_username?: string | null;
          is_active?: boolean;
          notify_degraded?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: AlertChannelType;
          telegram_chat_id?: number;
          telegram_username?: string | null;
          is_active?: boolean;
          notify_degraded?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      telegram_link_tokens: {
        Row: {
          id: string;
          user_id: string;
          token_hash: string;
          expires_at: string;
          used_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          token_hash: string;
          expires_at: string;
          used_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          token_hash?: string;
          expires_at?: string;
          used_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      alert_events: {
        Row: {
          id: string;
          user_id: string;
          monitor_id: string;
          channel_id: string | null;
          type: AlertEventType;
          status_code: number | null;
          latency_ms: number | null;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          monitor_id: string;
          channel_id?: string | null;
          type: AlertEventType;
          status_code?: number | null;
          latency_ms?: number | null;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          monitor_id?: string;
          channel_id?: string | null;
          type?: AlertEventType;
          status_code?: number | null;
          latency_ms?: number | null;
          error_message?: string | null;
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
