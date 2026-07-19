import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

function cors(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  return res;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get('filePath');
    const expiresIn = parseInt(searchParams.get('expiresIn') || '60');

    if (!filePath) {
      return cors(NextResponse.json({ error: 'Missing filePath' }, { status: 400 }));
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase.storage
      .from('driver-documents')
      .createSignedUrl(filePath, expiresIn);

    if (error) throw error;

    return cors(NextResponse.json({ url: data.signedUrl }));
  } catch (err: any) {
    console.error('URL sign error:', err);
    return cors(NextResponse.json({ error: err.message }, { status: 500 }));
  }
}
