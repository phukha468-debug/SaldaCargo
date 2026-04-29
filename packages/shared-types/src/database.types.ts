// Этот файл генерируется командой: pnpm gen:types
// Запускать после каждой миграции БД: supabase gen types typescript --local
// НЕ редактировать вручную.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// Placeholder — будет перезаписан после TASK_07 (первая миграция БД)
export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
