import { type ZodType, type ZodTypeDef } from 'zod';
import { type SaldaModule } from '@saldacargo/shared';
import {
  createApiHandler,
  type ApiHandlerContext,
  type RateLimitOptions,
} from '@saldacargo/shared/api-handler';
import { requireAuth, requireRole, type VerifiedWebUser } from '@/lib/auth';

export interface WebApiOptions<TBody, TQuery> {
  routeName?: string;
  roles?: string[];
  requireAuth?: boolean;
  requiredModule?: SaldaModule;
  bodySchema?: ZodType<TBody, ZodTypeDef, unknown>;
  querySchema?: ZodType<TQuery, ZodTypeDef, unknown>;
  rateLimit?: RateLimitOptions & { keyPrefix: string };
}

/**
 * Единая типизированная обёртка API-роутов для WebApp:
 * - автоматический RBAC (`roles` или `requireAuth`)
 * - multi-tenant контекст организации (`auth.organizationId`, `auth.orgSettings`, `auth.enabledModules`)
 * - проверка Feature Flag модуля (`requiredModule` → 403 MODULE_DISABLED)
 * - Zod-валидация body и query
 * - стандартизированная обработка ошибок и логирование
 */
export function createWebApiHandler<
  TBody = undefined,
  TQuery = Record<string, string>,
  TParams = Record<string, string>,
>(
  options: WebApiOptions<TBody, TQuery>,
  handler: (ctx: ApiHandlerContext<TBody, TQuery, VerifiedWebUser, TParams>) => Promise<Response>,
) {
  return createApiHandler<TBody, TQuery, VerifiedWebUser, TParams>(
    {
      routeName: options.routeName,
      bodySchema: options.bodySchema,
      querySchema: options.querySchema,
      rateLimit: options.rateLimit,
      resolveAuth: async () => {
        if (options.roles && options.roles.length > 0) {
          return requireRole(options.roles, options.requiredModule);
        }
        return requireAuth(options.requiredModule);
      },
    },
    handler,
  );
}
