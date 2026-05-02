'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@saldacargo/shared-types';

interface UseUserResult {
  user: User | null;
  loading: boolean;
  error: string | null;
}

/**
 * Хук возвращает текущего пользователя из таблицы users.
 * Не из auth.users — оттуда только email.
 * Реальные данные (роли, имя, машина) — из нашей таблицы users.
 */
export function useUser(): UseUserResult {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function loadUser() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('max_user_id', authUser.id)
        .single();

      if (error) {
        // Попробуем по email (для web-логина через magic link)
        const { data: byEmail, error: emailError } = await supabase
          .from('users')
          .select('*')
          .eq('phone', authUser.email ?? '')
          .single();


        if (emailError) {
          setError('Пользователь не найден в системе');
        } else {
          setUser(byEmail as User);
        }
      } else {
        setUser(data as User);
      }
      setLoading(false);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadUser();
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading, error };
}
