import { z, type ZodType, type ZodTypeDef } from 'zod';
import { isEnvConfigError } from './env';
import { checkRateLimit, getClientIp, type RateLimitOptions } from './rateLimit';
import { logger, reportError } from './logger';

export type { RateLimitOptions };

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export interface ApiHandlerContext<TBody, TQuery, TAuth, TParams = Record<string, string>> {
  request: Request;
  body: TBody;
  query: TQuery;
  auth: TAuth;
  params: TParams;
}

export interface ApiHandlerOptions<TBody, TQuery, TAuth> {
  routeName?: string;
  resolveAuth?: (request: Request) => Promise<TAuth | Response>;
  bodySchema?: ZodType<TBody, ZodTypeDef, unknown>;
  querySchema?: ZodType<TQuery, ZodTypeDef, unknown>;
  rateLimit?: RateLimitOptions & { keyPrefix: string };
}

function jsonResponse(payload: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

/**
 * Типизированная обёртка API-роутов:
 * - Rate Limiting
 * - Auth / RBAC проверка
 * - Zod-валидация query и JSON body
 * - Единая обработка ошибок (400 / 401 / 403 / 429 / 503 / 500) + структурированное логирование и Sentry
 */
export function createApiHandler<
  TBody = undefined,
  TQuery = Record<string, string>,
  TAuth = undefined,
  TParams = Record<string, string>,
>(
  options: ApiHandlerOptions<TBody, TQuery, TAuth>,
  handler: (ctx: ApiHandlerContext<TBody, TQuery, TAuth, TParams>) => Promise<Response>,
) {
  return async (
    request: Request,
    routeCtx?: { params?: Promise<TParams> | TParams },
  ): Promise<Response> => {
    const route = options.routeName ?? new URL(request.url).pathname;

    try {
      if (options.rateLimit) {
        const ip = getClientIp(request);
        const rl = checkRateLimit(`${options.rateLimit.keyPrefix}:${ip}`, {
          limit: options.rateLimit.limit,
          windowMs: options.rateLimit.windowMs,
        });
        if (!rl.allowed) {
          return jsonResponse({ error: 'Слишком много запросов. Попробуйте позже.' }, 429, {
            'Retry-After': String(rl.retryAfterSeconds),
          });
        }
      }

      let auth = undefined as TAuth;
      if (options.resolveAuth) {
        const authResult = await options.resolveAuth(request);
        if (authResult instanceof Response) {
          return authResult;
        }
        auth = authResult;
      }

      const rawParams = routeCtx?.params ? await routeCtx.params : ({} as TParams);

      let query = {} as TQuery;
      if (options.querySchema) {
        const url = new URL(request.url);
        const queryObj: Record<string, string> = {};
        url.searchParams.forEach((value, key) => {
          queryObj[key] = value;
        });
        const parsedQuery = options.querySchema.safeParse(queryObj);
        if (!parsedQuery.success) {
          return jsonResponse(
            {
              error: 'Некорректные параметры запроса',
              details: parsedQuery.error.flatten().fieldErrors,
            },
            400,
          );
        }
        query = parsedQuery.data;
      }

      let body = undefined as TBody;
      if (options.bodySchema) {
        let rawBody: unknown;
        try {
          rawBody = await request.json();
        } catch {
          return jsonResponse({ error: 'Ожидается корректный JSON в теле запроса' }, 400);
        }
        const parsedBody = options.bodySchema.safeParse(rawBody);
        if (!parsedBody.success) {
          return jsonResponse(
            {
              error: 'Ошибка валидации входных данных',
              details: parsedBody.error.flatten().fieldErrors,
            },
            400,
          );
        }
        body = parsedBody.data;
      }

      return await handler({
        request,
        body,
        query,
        auth,
        params: rawParams,
      });
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        return jsonResponse(
          { error: 'Ошибка валидации входных данных', details: err.flatten().fieldErrors },
          400,
        );
      }

      if (isEnvConfigError(err)) {
        logger.warn('Integration config missing', { route, integration: err.integration }, err);
        return jsonResponse({ error: err.message }, 503);
      }

      if (err instanceof ApiError) {
        return jsonResponse(
          {
            error: err.message,
            ...(err.code ? { code: err.code } : {}),
            ...(err.details ? { details: err.details } : {}),
          },
          err.statusCode,
        );
      }

      logger.error('Unhandled API route error', { route }, err);
      await reportError(err, { route });

      const message =
        process.env.NODE_ENV === 'production'
          ? 'Внутренняя ошибка сервера'
          : err instanceof Error
            ? err.message
            : 'Внутренняя ошибка сервера';

      return jsonResponse({ error: message }, 500);
    }
  };
}
