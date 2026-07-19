/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(req: Request) {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key');
    const { email, fileUrl, fileName } = await req.json();

    if (!email || !fileUrl || !fileName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Скачиваем файл из Supabase Storage по публичной или подписанной ссылке
    const fileResponse = await fetch(fileUrl);
    
    if (!fileResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch file from storage' }, { status: 500 });
    }

    const fileBuffer = await fileResponse.arrayBuffer();
    const buffer = Buffer.from(fileBuffer);

    // Отправляем письмо через Resend
    const data = await resend.emails.send({
      from: 'Acme <onboarding@resend.dev>', // Используем дефолтный тестовый адрес Resend
      to: [email],
      subject: `Документы водителя: ${fileName}`,
      text: 'Во вложении находятся документы водителя.',
      attachments: [
        {
          filename: fileName,
          content: buffer,
        },
      ],
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error sending email:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
