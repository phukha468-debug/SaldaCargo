/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { execFile } from 'child_process';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  let tmpPath: string | null = null;
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Файл не прикреплен' }, { status: 400 });
    }

    const ext = path.extname(file.name || '').toLowerCase() || '.pdf';
    const allowedExts = ['.pdf', '.png', '.jpg', '.jpeg'];
    if (!allowedExts.includes(ext)) {
      return NextResponse.json(
        { error: 'Поддерживаются только форматы PDF, PNG, JPG' },
        { status: 400 },
      );
    }

    // Сохраняем во временный файл
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const safeName = `contract_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    tmpPath = path.join(os.tmpdir(), safeName);
    await fs.promises.writeFile(tmpPath, buffer);

    // Вызываем оффлайн-парсер
    const scriptPath = path.resolve(process.cwd(), 'scripts', 'parse_contract.py');
    const stdout = await new Promise<string>((resolve, reject) => {
      execFile(
        'python',
        [scriptPath, tmpPath as string],
        { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 },
        (err, out, stderr) => {
          if (err) {
            return reject(new Error(stderr || err.message));
          }
          resolve(out);
        },
      );
    });

    let parsed: any;
    try {
      parsed = JSON.parse(stdout);
    } catch {
      return NextResponse.json(
        { error: 'Ошибка разбора ответа парсера', raw: stdout },
        { status: 500 },
      );
    }

    if (parsed.error) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    // Поиск контрагента в Supabase базе
    const supabase = createAdminClient();
    let matchedCounterparty: any = null;

    if (parsed.counterparty_inn) {
      const { data: byInn } = await (supabase.from('counterparties') as any)
        .select('id, name, inn, phone, email, contact_person, legal_address')
        .eq('inn', parsed.counterparty_inn)
        .limit(1);

      if (byInn && byInn.length > 0) {
        matchedCounterparty = byInn[0];
      }
    }

    if (!matchedCounterparty && parsed.counterparty_name) {
      // Ищем по характерному слову из названия компании (напр. "ТРАНССЕРВИС", "БТК", "Байт")
      const words = parsed.counterparty_name
        .replace(/[^а-яА-Яa-zA-Z0-9]/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(
          (w: string) => w.length >= 3 && !['ООО', 'ЗАО', 'ОАО', 'ПАО'].includes(w.toUpperCase()),
        );

      for (const word of words) {
        const { data: byName } = await (supabase.from('counterparties') as any)
          .select('id, name, inn, phone, email, contact_person, legal_address')
          .ilike('name', `%${word}%`)
          .limit(1);

        if (byName && byName.length > 0) {
          matchedCounterparty = byName[0];
          break;
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...parsed,
        matched_counterparty: matchedCounterparty,
      },
    });
  } catch (error: any) {
    console.error('Error parsing contract order:', error);
    return NextResponse.json(
      { error: error?.message || 'Не удалось распознать договор-заявку' },
      { status: 500 },
    );
  } finally {
    if (tmpPath && fs.existsSync(tmpPath)) {
      await fs.promises.unlink(tmpPath).catch(() => {});
    }
  }
}
