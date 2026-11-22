const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): boolean {
  return typeof value === 'string' && UUID_REGEX.test(value.trim());
}

/**
 * Безопасно очищает пользовательскую строку для использования в PostgREST `.or(...)` фильтрах.
 * Удаляет управляющие символы PostgREST (`,`, `(`, `)`, `*`, `\`, `"`, `%`, `'`), предотвращая
 * PostgREST Filter Injection.
 */
export function escapePostgrestValue(raw: string): string {
  return raw
    .trim()
    .replace(/[\\,"%*()'{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Собирает безопасный `.or(...)` фильтр с `ilike` по списку колонок.
 * Возвращает null, если после экранирования строка пуста.
 */
export function buildIlikeOrFilter(columns: readonly string[], rawQuery: string): string | null {
  const safe = escapePostgrestValue(rawQuery);
  if (!safe || columns.length === 0) return null;
  return columns.map((col) => `${col}.ilike.%${safe}%`).join(',');
}
