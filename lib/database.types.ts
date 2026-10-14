// Generiert aus dem Supabase-Schema (supabase gen types typescript), gekürzt auf das Nötige.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Rel = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

export type UserRole = "admin" | "editor" | "viewer";

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.18" };
  public: {
    Tables: {
      ai_usage: {
        Row: { count: number; day: string; user_id: string };
        Insert: { count?: number; day?: string; user_id: string };
        Update: { count?: number; day?: string; user_id?: string };
        Relationships: Rel[];
      };
      entries: {
        Row: {
          content_json: Json;
          content_text: string;
          created_at: string;
          created_by: string | null;
          id: string;
          isin_items: Json;
          kind: string | null;
          pinned: boolean;
          search_vector: unknown;
          sort_order: number;
          title: string;
          topic_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          content_json?: Json;
          content_text?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          pinned?: boolean;
          sort_order?: number;
          title?: string;
          topic_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          content_json?: Json;
          content_text?: string;
          id?: string;
          isin_items?: Json;
          pinned?: boolean;
          sort_order?: number;
          title?: string;
          topic_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "entries_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entries_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entries_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      entry_versions: {
        Row: {
          content_json: Json;
          created_at: string;
          edited_by: string | null;
          entry_id: string;
          id: string;
          title: string;
        };
        Insert: {
          content_json: Json;
          edited_by?: string | null;
          entry_id: string;
          title: string;
        };
        Update: { content_json?: Json; title?: string };
        Relationships: [
          {
            foreignKeyName: "entry_versions_edited_by_fkey";
            columns: ["edited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      favorites: {
        Row: { created_at: string; entry_id: string; user_id: string };
        Insert: { entry_id: string; user_id?: string };
        Update: { entry_id?: string };
        Relationships: [
          {
            foreignKeyName: "favorites_entry_id_fkey";
            columns: ["entry_id"];
            isOneToOne: false;
            referencedRelation: "entries";
            referencedColumns: ["id"];
          },
        ];
      };
      mobile_upload_sessions: {
        Row: { created_at: string; created_by: string; entry_id: string; expires_at: string; id: string };
        Insert: { entry_id: string; created_by?: string; expires_at?: string; id?: string };
        Update: { expires_at?: string };
        Relationships: Rel[];
      };
      people: {
        Row: {
          avatar_url: string | null;
          bio: string;
          created_at: string;
          department: string;
          email: string;
          id: string;
          name: string;
          phone: string;
          position: string;
          profile_id: string | null;
          tags: string[];
          teams_url: string;
        };
        Insert: {
          avatar_url?: string | null;
          bio?: string;
          department?: string;
          email?: string;
          id?: string;
          name: string;
          phone?: string;
          position?: string;
          profile_id?: string | null;
          tags?: string[];
          teams_url?: string;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string;
          department?: string;
          email?: string;
          name?: string;
          phone?: string;
          position?: string;
          profile_id?: string | null;
          tags?: string[];
          teams_url?: string;
        };
        Relationships: Rel[];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          full_name: string;
          id: string;
          role: UserRole;
        };
        Insert: {
          avatar_url?: string | null;
          email?: string | null;
          full_name?: string;
          id: string;
          role?: UserRole;
        };
        Update: { avatar_url?: string | null; full_name?: string; role?: UserRole };
        Relationships: [];
      };
      topic_contacts: {
        Row: { label: string; person_id: string; topic_id: string };
        Insert: { label?: string; person_id: string; topic_id: string };
        Update: { label?: string };
        Relationships: [
          {
            foreignKeyName: "topic_contacts_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "topic_contacts_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["id"];
          },
        ];
      };
      topics: {
        Row: {
          archived: boolean;
          color: string;
          created_at: string;
          created_by: string | null;
          description: string;
          icon: string;
          id: string;
          name: string;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          archived?: boolean;
          color?: string;
          description?: string;
          icon?: string;
          name: string;
          slug: string;
          sort_order?: number;
        };
        Update: {
          archived?: boolean;
          color?: string;
          description?: string;
          icon?: string;
          name?: string;
          slug?: string;
          sort_order?: number;
        };
        Relationships: Rel[];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      consume_ai_quota: { Args: { daily_limit: number }; Returns: boolean };
      mobile_session_expires: { Args: { session: string }; Returns: string | null };
      search_all: {
        Args: { max_results?: number; q: string; topic_filter?: string };
        Returns: {
          id: string;
          kind: string;
          rank: number;
          snippet: string;
          title: string;
          topic_color: string;
          topic_id: string;
          topic_name: string;
          topic_slug: string;
        }[];
      };
    };
    Enums: { user_role: UserRole };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicTables = Database["public"]["Tables"];
export type Tables<T extends keyof PublicTables> = PublicTables[T]["Row"];
export type SearchHit = Database["public"]["Functions"]["search_all"]["Returns"][number];
