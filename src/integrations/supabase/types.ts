export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      assignment_rules: {
        Row: {
          assign_to_agent_id: string | null
          created_at: string
          id: string
          is_active: boolean | null
          match_field: string
          match_value: string
          name: string
          priority: number | null
        }
        Insert: {
          assign_to_agent_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          match_field: string
          match_value: string
          name: string
          priority?: number | null
        }
        Update: {
          assign_to_agent_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          match_field?: string
          match_value?: string
          name?: string
          priority?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assignment_rules_assign_to_agent_id_fkey"
            columns: ["assign_to_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: string | null
          entity: string
          entity_id: string | null
          id: string
          user_name: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          entity: string
          entity_id?: string | null
          id?: string
          user_name: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          entity?: string
          entity_id?: string | null
          id?: string
          user_name?: string
        }
        Relationships: []
      }
      branding_settings: {
        Row: {
          accent_color: string | null
          company_id: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          default_currency: string | null
          default_timezone: string | null
          font_body: string | null
          font_heading: string | null
          id: string
          logo_url: string | null
          primary_color: string | null
          secondary_color: string | null
          system_name: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          accent_color?: string | null
          company_id?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          default_currency?: string | null
          default_timezone?: string | null
          font_body?: string | null
          font_heading?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          system_name?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          accent_color?: string | null
          company_id?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          default_currency?: string | null
          default_timezone?: string | null
          font_body?: string | null
          font_heading?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          system_name?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branding_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_templates: {
        Row: {
          created_at: string
          fields: Json
          id: string
          name: string
          template_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fields?: Json
          id?: string
          name: string
          template_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fields?: Json
          id?: string
          name?: string
          template_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      commissions: {
        Row: {
          agent_id: string | null
          commission_amount: number
          commission_rate: number
          created_at: string
          deal_id: string | null
          deal_value: number
          id: string
          paid_date: string | null
          status: Database["public"]["Enums"]["commission_status"]
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          commission_amount?: number
          commission_rate?: number
          created_at?: string
          deal_id?: string | null
          deal_value?: number
          id?: string
          paid_date?: string | null
          status?: Database["public"]["Enums"]["commission_status"]
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          commission_amount?: number
          commission_rate?: number
          created_at?: string
          deal_id?: string | null
          deal_value?: number
          id?: string
          paid_date?: string | null
          status?: Database["public"]["Enums"]["commission_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          name: string
          owner: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      deals: {
        Row: {
          assigned_agent_id: string | null
          closed_at: string | null
          created_at: string
          expected_close: string | null
          id: string
          lead_id: string | null
          probability: number | null
          property_id: string | null
          stage: Database["public"]["Enums"]["lead_status"]
          updated_at: string
          value: number
        }
        Insert: {
          assigned_agent_id?: string | null
          closed_at?: string | null
          created_at?: string
          expected_close?: string | null
          id?: string
          lead_id?: string | null
          probability?: number | null
          property_id?: string | null
          stage?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          value?: number
        }
        Update: {
          assigned_agent_id?: string | null
          closed_at?: string | null
          created_at?: string
          expected_close?: string | null
          id?: string
          lead_id?: string | null
          probability?: number | null
          property_id?: string | null
          stage?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "deals_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          file_type: string | null
          file_url: string
          id: string
          name: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          file_type?: string | null
          file_url: string
          id?: string
          name: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          file_type?: string | null
          file_url?: string
          id?: string
          name?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_messages: {
        Row: {
          body: string
          created_at: string
          direction: Database["public"]["Enums"]["email_direction"]
          from_address: string
          id: string
          thread_id: string
          to_address: string
        }
        Insert: {
          body: string
          created_at?: string
          direction?: Database["public"]["Enums"]["email_direction"]
          from_address: string
          id?: string
          thread_id: string
          to_address: string
        }
        Update: {
          body?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["email_direction"]
          from_address?: string
          id?: string
          thread_id?: string
          to_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "email_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      email_threads: {
        Row: {
          created_at: string
          id: string
          is_unread: boolean | null
          last_message_at: string | null
          lead_id: string | null
          subject: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_unread?: boolean | null
          last_message_at?: string | null
          lead_id?: string | null
          subject: string
        }
        Update: {
          created_at?: string
          id?: string
          is_unread?: boolean | null
          last_message_at?: string | null
          lead_id?: string | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_threads_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      ingestion_sources: {
        Row: {
          config: Json | null
          created_at: string
          id: string
          is_active: boolean | null
          last_sync: string | null
          leads_ingested: number | null
          name: string
          platform: string
          type: string
          updated_at: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_sync?: string | null
          leads_ingested?: number | null
          name: string
          platform: string
          type: string
          updated_at?: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_sync?: string | null
          leads_ingested?: number | null
          name?: string
          platform?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_activities: {
        Row: {
          created_at: string
          description: string
          id: string
          lead_id: string
          type: Database["public"]["Enums"]["activity_type"]
          user_name: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          lead_id: string
          type: Database["public"]["Enums"]["activity_type"]
          user_name: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          lead_id?: string
          type?: Database["public"]["Enums"]["activity_type"]
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_agent_id: string | null
          budget: string | null
          channel: string | null
          client_type: Database["public"]["Enums"]["client_type"]
          created_at: string
          email: string | null
          id: string
          last_contact: string | null
          name: string
          notes: string | null
          pf_created_at: string | null
          pf_lead_id: string | null
          pf_listing_ref: string | null
          pf_response_link: string | null
          pf_status: string | null
          phone: string | null
          property_id: string | null
          score: number | null
          sla_deadline: string | null
          source: Database["public"]["Enums"]["lead_source"]
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          assigned_agent_id?: string | null
          budget?: string | null
          channel?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          created_at?: string
          email?: string | null
          id?: string
          last_contact?: string | null
          name: string
          notes?: string | null
          pf_created_at?: string | null
          pf_lead_id?: string | null
          pf_listing_ref?: string | null
          pf_response_link?: string | null
          pf_status?: string | null
          phone?: string | null
          property_id?: string | null
          score?: number | null
          sla_deadline?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          assigned_agent_id?: string | null
          budget?: string | null
          channel?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          created_at?: string
          email?: string | null
          id?: string
          last_contact?: string | null
          name?: string
          notes?: string | null
          pf_created_at?: string | null
          pf_lead_id?: string | null
          pf_listing_ref?: string | null
          pf_response_link?: string | null
          pf_status?: string | null
          phone?: string | null
          property_id?: string | null
          score?: number | null
          sla_deadline?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean | null
          message: string
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          title: string
          type?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolios: {
        Row: {
          company_id: string
          created_at: string
          id: string
          name: string
          status: string
          type: Database["public"]["Enums"]["portfolio_type"]
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          name: string
          status?: string
          type?: Database["public"]["Enums"]["portfolio_type"]
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          status?: string
          type?: Database["public"]["Enums"]["portfolio_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolios_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          base_salary: number | null
          brn: string | null
          created_at: string
          department: string | null
          email: string
          experience_since: number | null
          full_name: string
          id: string
          is_active: boolean | null
          languages: string[] | null
          last_login: string | null
          nationality: string | null
          pf_agent_id: string | null
          pf_status: string | null
          pf_url: string | null
          phone: string | null
          specializations: string[] | null
          title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          base_salary?: number | null
          brn?: string | null
          created_at?: string
          department?: string | null
          email: string
          experience_since?: number | null
          full_name: string
          id?: string
          is_active?: boolean | null
          languages?: string[] | null
          last_login?: string | null
          nationality?: string | null
          pf_agent_id?: string | null
          pf_status?: string | null
          pf_url?: string | null
          phone?: string | null
          specializations?: string[] | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          base_salary?: number | null
          brn?: string | null
          created_at?: string
          department?: string | null
          email?: string
          experience_since?: number | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          languages?: string[] | null
          last_login?: string | null
          nationality?: string | null
          pf_agent_id?: string | null
          pf_status?: string | null
          pf_url?: string | null
          phone?: string | null
          specializations?: string[] | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      properties: {
        Row: {
          amenities: string[] | null
          area: number
          available_from: string | null
          bathrooms: number
          bayut_url: string | null
          bedrooms: number
          category: string | null
          commission_rate: number
          created_at: string
          description: string | null
          dubizzle_url: string | null
          emirate: string | null
          furnishing_type: string | null
          id: string
          images: string[] | null
          listing_id: string | null
          location: string
          pf_assigned_agent_id: string | null
          pf_created_at: string | null
          pf_id: string | null
          pf_updated_at: string | null
          pf_url: string | null
          portfolio_id: string | null
          price: number
          price_type: string | null
          project_status: string | null
          quality_score: number | null
          rera_number: string | null
          status: Database["public"]["Enums"]["property_status"]
          title: string
          type: Database["public"]["Enums"]["property_type"]
          updated_at: string
          verification_status: string | null
        }
        Insert: {
          amenities?: string[] | null
          area?: number
          available_from?: string | null
          bathrooms?: number
          bayut_url?: string | null
          bedrooms?: number
          category?: string | null
          commission_rate?: number
          created_at?: string
          description?: string | null
          dubizzle_url?: string | null
          emirate?: string | null
          furnishing_type?: string | null
          id?: string
          images?: string[] | null
          listing_id?: string | null
          location: string
          pf_assigned_agent_id?: string | null
          pf_created_at?: string | null
          pf_id?: string | null
          pf_updated_at?: string | null
          pf_url?: string | null
          portfolio_id?: string | null
          price?: number
          price_type?: string | null
          project_status?: string | null
          quality_score?: number | null
          rera_number?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          title: string
          type?: Database["public"]["Enums"]["property_type"]
          updated_at?: string
          verification_status?: string | null
        }
        Update: {
          amenities?: string[] | null
          area?: number
          available_from?: string | null
          bathrooms?: number
          bayut_url?: string | null
          bedrooms?: number
          category?: string | null
          commission_rate?: number
          created_at?: string
          description?: string | null
          dubizzle_url?: string | null
          emirate?: string | null
          furnishing_type?: string | null
          id?: string
          images?: string[] | null
          listing_id?: string | null
          location?: string
          pf_assigned_agent_id?: string | null
          pf_created_at?: string | null
          pf_id?: string | null
          pf_updated_at?: string | null
          pf_url?: string | null
          portfolio_id?: string | null
          price?: number
          price_type?: string | null
          project_status?: string | null
          quality_score?: number | null
          rera_number?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          title?: string
          type?: Database["public"]["Enums"]["property_type"]
          updated_at?: string
          verification_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      property_agents: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          property_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          property_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_agents_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_agents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          is_active: boolean
          last_seen_at: string
          p256dh: string
          profile_id: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          p256dh: string
          profile_id: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          p256dh?: string
          profile_id?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      property_analytics: {
        Row: {
          calls_count: number
          clicks: number
          created_at: string
          date: string
          id: string
          leads_count: number
          pf_listing_id: string | null
          property_id: string | null
          updated_at: string
          views: number
        }
        Insert: {
          calls_count?: number
          clicks?: number
          created_at?: string
          date?: string
          id?: string
          leads_count?: number
          pf_listing_id?: string | null
          property_id?: string | null
          updated_at?: string
          views?: number
        }
        Update: {
          calls_count?: number
          clicks?: number
          created_at?: string
          date?: string
          id?: string
          leads_count?: number
          pf_listing_id?: string | null
          property_id?: string | null
          updated_at?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "property_analytics_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          body: string
          contact_wa_id: string | null
          created_at: string
          direction: Database["public"]["Enums"]["whatsapp_direction"]
          id: string
          lead_id: string | null
          provider_status: string | null
          raw_payload: Json | null
          sent_by_profile_id: string | null
          wa_message_id: string | null
        }
        Insert: {
          body?: string
          contact_wa_id?: string | null
          created_at?: string
          direction: Database["public"]["Enums"]["whatsapp_direction"]
          id?: string
          lead_id?: string | null
          provider_status?: string | null
          raw_payload?: Json | null
          sent_by_profile_id?: string | null
          wa_message_id?: string | null
        }
        Update: {
          body?: string
          contact_wa_id?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["whatsapp_direction"]
          id?: string
          lead_id?: string | null
          provider_status?: string | null
          raw_payload?: Json | null
          sent_by_profile_id?: string | null
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_sent_by_profile_id_fkey"
            columns: ["sent_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_secrets: {
        Row: {
          created_at: string
          description: string | null
          id: string
          label: string
          slug: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          label: string
          slug: string
          updated_at?: string
          value?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          slug?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_delete_all_leads: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      admin_delete_all_properties: {
        Args: { p_confirm: string }
        Returns: Json
      }
      admin_delete_pf_agent_profiles_only: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      activity_type:
        | "call"
        | "email"
        | "whatsapp"
        | "note"
        | "viewing"
        | "status_change"
      app_role: "super_admin" | "admin" | "manager" | "salesperson" | "finance"
      client_type:
        | "prospect"
        | "active_lead"
        | "previous_buyer"
        | "investor"
        | "lost_lead"
      commission_status: "pending" | "approved" | "paid"
      email_direction: "inbound" | "outbound"
      lead_source:
        | "bayut"
        | "property_finder"
        | "dubizzle"
        | "website"
        | "referral"
        | "walk_in"
      lead_status:
        | "new"
        | "contacted"
        | "qualified"
        | "viewing"
        | "negotiation"
        | "closed_won"
        | "closed_lost"
      portfolio_type: "residential" | "commercial" | "off_plan" | "mixed"
      property_status: "available" | "reserved" | "sold" | "off_market"
      property_type:
        | "apartment"
        | "villa"
        | "office"
        | "penthouse"
        | "townhouse"
      whatsapp_direction: "inbound" | "outbound"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_type: [
        "call",
        "email",
        "whatsapp",
        "note",
        "viewing",
        "status_change",
      ],
      app_role: ["super_admin", "admin", "manager", "salesperson", "finance"],
      client_type: [
        "prospect",
        "active_lead",
        "previous_buyer",
        "investor",
        "lost_lead",
      ],
      commission_status: ["pending", "approved", "paid"],
      email_direction: ["inbound", "outbound"],
      lead_source: [
        "bayut",
        "property_finder",
        "dubizzle",
        "website",
        "referral",
        "walk_in",
      ],
      lead_status: [
        "new",
        "contacted",
        "qualified",
        "viewing",
        "negotiation",
        "closed_won",
        "closed_lost",
      ],
      portfolio_type: ["residential", "commercial", "off_plan", "mixed"],
      property_status: ["available", "reserved", "sold", "off_market"],
      property_type: ["apartment", "villa", "office", "penthouse", "townhouse"],
      whatsapp_direction: ["inbound", "outbound"],
    },
  },
} as const
