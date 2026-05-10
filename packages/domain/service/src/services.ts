/* eslint-disable @typescript-eslint/no-explicit-any */
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
    .select(
      `
      id, order_number, machine_type, asset_id, status,
      asset:assets(short_name, reg_number),
      client_vehicle_brand, client_vehicle_reg
    `,
    )
    .eq('assigned_mechanic_id', mechanicId)
    .eq('status', 'in_progress')
    .maybeSingle();

  // 2. Считаем количество назначенных нарядов (не начатых)
  const { count: assignedCount } = await supabase
    .from('service_orders')
    .select('*', { count: 'exact', head: true })
    .eq('assigned_mechanic_id', mechanicId)
    .eq('lifecycle_status', 'approved')
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
    .select(
      `
      id, order_number, machine_type, status, priority, created_at,
      asset:assets(short_name),
      client_vehicle_brand, client_vehicle_reg
    `,
    )
    .eq('assigned_mechanic_id', mechanicId)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  } else {
    query = query.eq('lifecycle_status', 'approved').in('status', ['created', 'in_progress']);
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
    .select(
      `
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
    `,
    )
    .eq('id', orderId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Начинает работу по наряду (запускает таймер).
 */
export async function startWork(supabase: Client, workId: string) {
  const { data, error } = await (supabase.from('work_time_logs') as any)
    .insert({
      service_order_work_id: workId,
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;

  await (supabase.from('service_order_works') as any)
    .update({ status: 'in_progress' })
    .eq('id', workId);

  const { data: work } = await (supabase.from('service_order_works') as any)
    .select('service_order_id')
    .eq('id', workId)
    .single();

  if (work) {
    await (supabase.from('service_orders') as any)
      .update({ status: 'in_progress' })
      .eq('id', work.service_order_id);
  }

  return data;
}

/**
 * Останавливает/паузит работу и сохраняет фактическое время.
 */
export async function stopWork(supabase: Client, workId: string, status: 'paused' | 'completed') {
  const now = new Date().toISOString();

  // 1. Находим активный лог чтобы знать started_at
  const { data: runningLog, error: findError } = await (supabase.from('work_time_logs') as any)
    .select('id, started_at')
    .eq('service_order_work_id', workId)
    .eq('status', 'running')
    .single();

  if (findError || !runningLog) throw new Error('Активный таймер не найден');

  // 2. Закрываем лог
  const { error: logError } = await (supabase.from('work_time_logs') as any)
    .update({
      stopped_at: now,
      status: status === 'paused' ? 'paused' : 'completed',
    })
    .eq('id', runningLog.id);

  if (logError) throw logError;

  // 3. Суммируем actual_minutes по ВСЕМ закрытым логам этой работы
  const { data: allLogs } = await (supabase.from('work_time_logs') as any)
    .select('started_at, stopped_at')
    .eq('service_order_work_id', workId)
    .not('stopped_at', 'is', null);

  const totalMinutes = ((allLogs as any[]) ?? []).reduce((sum: number, log: any) => {
    const ms = new Date(log.stopped_at).getTime() - new Date(log.started_at).getTime();
    return sum + Math.max(0, Math.floor(ms / 60000));
  }, 0);

  // 4. Обновляем статус работы и фактическое время
  const { error: workError } = await (supabase.from('service_order_works') as any)
    .update({
      status,
      actual_minutes: totalMinutes,
    })
    .eq('id', workId);

  if (workError) throw workError;

  return { success: true, actual_minutes: totalMinutes };
}
