import { supabase } from './supabase';
import { UserProfile } from '@saldacargo/shared-types';

export const getMe = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  return profile as UserProfile | null;
};

export const logout = () => supabase.auth.signOut();
