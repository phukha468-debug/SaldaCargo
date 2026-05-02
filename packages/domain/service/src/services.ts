import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@saldacargo/shared-types';

type Client = SupabaseClient<Database>;

/**
 * Получает сводку для главного экрана механика.
 */
export async function getMechanicSummary(supabase: Client, mechanicId: string) {
  // 1. Ищем активный наряд (где есть запущенный таймер)
  const { data: activeOrder } = await supabase
    .from('service_orders')
    .select(`
      id, order_number, machine_type, asset_id, status,
      asset:assets(short_name, reg_number),
      client_vehicle_brand, client_vehicle_reg
    `)
    .eq('assigned_mechanic_id', mechanicId)
    .eq('status', 'in_progress')
    .maybeSingle();

  // 2. Считаем количество назначенных нарядов (не начатых)
  const { count: assignedCount } = await supabase
    .from('service_orders')
    .select('*', { count: 'exact', head: true })
    .eq('assigned_mechanic_id', mechanicId)
    .eq('status', 'created');

  // 3. Считаем завершённые сегодня
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const { count: completedToday } = await supabase
    .from('service_orders')
    .select('*', { count: 'exact', head: true })
    .eq('assigned_mechanic_id', mechanicId)
    .eq('status', 'completed')
    .gte('updated_at', today.toISOString());

  return {
    activeOrder,
    assignedCount: assignedCount || 0,
    completedToday: completedToday || 0,
  };
}

/**
 * Получает список нарядов для механика.
 */
export async function getMechanicOrders(supabase: Client, mechanicId: string, status?: string) {
  let query = supabase
    .from('service_orders')
    .select(`
      id, order_number, machine_type, status, priority, created_at,
      asset:assets(short_name),
      client_vehicle_brand, client_vehicle_reg
    `)
    .eq('assigned_mechanic_id', mechanicId)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  } else {
    query = query.in('status', ['created', 'in_progress']);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Получает детализацию наряда.
 */
export async function getOrderDetail(supabase: Client, orderId: string) {
  const { data, error } = await supabase
    .from('service_orders')
    .select(`
      *,
      asset:assets(*),
      works:service_order_works(
        *,
        work_catalog:work_catalog(name, norm_minutes),
        time_logs:work_time_logs(*)
      ),
      parts:service_order_parts(
        *,
        part:parts(name, unit)
      )
    `)
    .eq('id', orderId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Начинает работу по наряду (запускает таймер).
 */
export async function startWork(supabase: Client, workId: string) {
  // 1. Проверяем, нет ли уже запущенного таймера у этого механика (делается триггером в БД)
  // Но мы всё равно отправим запрос
  const { data, error } = await supabase
    .from('work_time_logs')
    .insert({
      service_order_work_id: workId,
      status: 'running',
      started_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;

  // 2. Обновляем статус работы и наряда
  await supabase
    .from('service_order_works')
    .update({ status: 'in_progress' })
    .eq('id', workId);

  // Получаем ID наряда чтобы обновить его статус
  const { data: work } = await supabase
    .from('service_order_works')
    .select('service_order_id')
    .eq('id', workId)
    .single();

  if (work) {
    await supabase
      .from('service_orders')
      .update({ status: 'in_progress' })
      .eq('id', work.service_order_id);
  }

  return data;
}

/**
 * Останавливает/паузит работу.
 */
export async function stopWork(supabase: Client, workId: string, status: 'paused' | 'completed') {
  const now = new Date().toISOString();

  // 1. Закрываем активный лог времени
  const { error: logError } = await supabase
    .from('work_time_logs')
    .update({ 
      stopped_at: now,
      status: status === 'paused' ? 'paused' : 'completed'
    })
    .eq('service_order_work_id', workId)
    .eq('status', 'running');

  if (logError) throw logError;

  // 2. Обновляем статус самой работы
  const { error: workError } = await supabase
    .from('service_order_works')
    .update({ status: status })
    .eq('id', workId);

  if (workError) throw workError;

  return { success: true };
}
