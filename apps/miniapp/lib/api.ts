import { type ZodType, type ZodTypeDef } from 'zod';
import { type SaldaModule } from '@saldacargo/shared';
import {
  createApiHandler,
  type ApiHandlerContext,
  type RateLimitOptions,
} from '@saldacargo/shared/api-handler';
import { requireRole, requireSession, type VerifiedMiniappUser } from '@/lib/auth/server';

export interface MiniappApiOptions<TBody, TQuery> {
  routeName?: string;
  roles?: string[];
  requiredModule?: SaldaModule;
  bodySchema?: ZodType<TBody, ZodTypeDef, unknown>;
  querySchema?: ZodType<TQuery, ZodTypeDef, unknown>;
  rateLimit?: RateLimitOptions & { keyPrefix: string };
}

/**
 * Единая типизированная обёртка API-роутов для MiniApp:
 * - автоматический RBAC (`roles` или `requireSession`)
 * - multi-tenant контекст организации (`auth.organizationId`, `auth.orgSettings`, `auth.enabledModules`)
 * - проверка Feature Flag модуля (`requiredModule` → 403 MODULE_DISABLED)
 * - Zod-валидация body и query
 * - стандартизированная обработка ошибок и логирование
 */
export function createMiniappApiHandler<
  TBody = undefined,
  TQuery = Record<string, string>,
  TParams = Record<string, string>,
>(
  options: MiniappApiOptions<TBody, TQuery>,
  handler: (
    ctx: ApiHandlerContext<TBody, TQuery, VerifiedMiniappUser, TParams>,
  ) => Promise<Response>,
) {
  return createApiHandler<TBody, TQuery, VerifiedMiniappUser, TParams>(
    {
      routeName: options.routeName,
      bodySchema: options.bodySchema,
      querySchema: options.querySchema,
      rateLimit: options.rateLimit,
      resolveAuth: async () => {
        if (options.roles && options.roles.length > 0) {
          return requireRole(options.roles, options.requiredModule);
        }
        return requireSession(options.requiredModule);
      },
    },
    handler,
  );
}
