export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            users: {
                Row: {
                    id: string
                    tenant_id: string
                    email: string
                    name: string | null
                    role: string | null
                    shift: string | null
                    status: string | null
                    created_at: string
                    [key: string]: any
                }
                Insert: {
                    id?: string
                    tenant_id?: string
                    email: string
                    name?: string | null
                    role?: string | null
                    shift?: string | null
                    status?: string | null
                    created_at?: string
                    [key: string]: any
                }
                Update: {
                    id?: string
                    tenant_id?: string
                    email?: string
                    name?: string | null
                    role?: string | null
                    shift?: string | null
                    status?: string | null
                    created_at?: string
                    [key: string]: any
                }
            }
            orders: {
                Row: {
                    id: string
                    tenant_id: string
                    created_at: string
                    [key: string]: any
                }
                Insert: { [key: string]: any }
                Update: { [key: string]: any }
            }
            cylinders: {
                Row: {
                    id: string
                    tenant_id: string
                    created_at: string
                    [key: string]: any
                }
                Insert: { [key: string]: any }
                Update: { [key: string]: any }
            }
            customers: {
                Row: {
                    id: string
                    tenant_id: string
                    created_at: string
                    [key: string]: any
                }
                Insert: { [key: string]: any }
                Update: { [key: string]: any }
            }
            trips: {
                Row: {
                    id: string
                    tenant_id: string
                    created_at: string
                    [key: string]: any
                }
                Insert: { [key: string]: any }
                Update: { [key: string]: any }
            }
            employee_wallets: {
                Row: {
                    id: string
                    tenant_id: string
                    created_at: string
                    [key: string]: any
                }
                Insert: { [key: string]: any }
                Update: { [key: string]: any }
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
    }
}
