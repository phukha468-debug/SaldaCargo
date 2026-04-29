export { UserRole, type User } from '@saldacargo/shared-types';

/**
 * Проверяет, имеет ли пользователь указанную роль.
 */
export function hasRole(user: { roles: string[] }, role: string): boolean {
  return user.roles.includes(role);
}

/**
 * Возвращает отображаемое имя роли на русском.
 */
export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    owner: 'Владелец',
    admin: 'Администратор',
    driver: 'Водитель',
    loader: 'Грузчик',
    mechanic: 'Механик',
    mechanic_lead: 'Старший механик',
    accountant: 'Бухгалтер',
  };
  return labels[role] ?? role;
}