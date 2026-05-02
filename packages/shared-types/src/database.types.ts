export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      [_ in string]: {
        Row: {
          [_ in string]: Json | null
        }
        Insert: {
          [_ in string]: Json | null
        }
        Update: {
          [_ in string]: Json | null
        }
      }
    }
    Views: {
      [_ in string]: {
        Row: {
          [_ in string]: Json | null
        }
      }
    }
    Enums: {
      [_ in string]: string
    }
  }
}
