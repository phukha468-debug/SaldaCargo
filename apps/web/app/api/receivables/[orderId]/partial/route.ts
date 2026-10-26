import { PATCH } from '../route';

/** POST /api/receivables/[orderId]/partial — алиас для обратной совместимости частичного погашения */
export async function POST(req: Request, context: { params: Promise<{ orderId: string }> }) {
  return PATCH(req, context);
}

export async function PATCH_ALIAS(req: Request, context: { params: Promise<{ orderId: string }> }) {
  return PATCH(req, context);
}
export { PATCH_ALIAS as PATCH };
