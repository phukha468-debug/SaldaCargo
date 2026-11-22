'use client';

import { useState } from 'react';
import type { PassportData, PayrollUser } from './types';

export function DriverPassportModal({
  user,
  passport,
  onClose,
}: {
  user: PayrollUser;
  passport: PassportData;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const series = String(passport.passport_series || '');
  const num = String(passport.passport_number || '');
  const fullName = String(passport.full_name || user.name);
  const issuedBy = String(passport.passport_issued_by || '');
  const issueDate = String(passport.passport_issue_date || '');
  const depCode = String(passport.passport_department_code || '');
  const regAddress = String(passport.registration_address || '');
  const birthDate = String(passport.birth_date || '');
  const birthPlace = String(passport.birth_place || '');
  const licenseUntil = String(passport.license_valid_until || '');
  const experienceFrom = String(passport.experience_from || '');

  const copyAll = () => {
    const text = [
      `ФИО: ${fullName}`,
      birthDate ? `Дата рождения: ${birthDate} ${birthPlace ? `(${birthPlace})` : ''}` : '',
      series && num ? `Паспорт РФ: серия ${series} № ${num}` : '',
      issuedBy ? `Кем выдан: ${issuedBy}` : '',
      issueDate ? `Дата выдачи: ${issueDate} (код: ${depCode})` : '',
      regAddress ? `Адрес регистрации: ${regAddress}` : '',
      licenseUntil ? `ВУ действительно до: ${licenseUntil}` : '',
      experienceFrom ? `Стаж с: ${experienceFrom} г.` : '',
    ]
      .filter(Boolean)
      .join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">🪪</span>
            <h3 className="font-bold text-sm text-white">Паспорт и документы водителя</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-lg leading-none cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-3 text-xs">
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Сотрудник
            </p>
            <p className="text-sm font-bold text-slate-900">{fullName}</p>
          </div>

          {(birthDate || birthPlace) && (
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-slate-400 font-medium">Дата и место рождения:</span>{' '}
                <span className="font-semibold text-slate-800">
                  {birthDate} {birthPlace && `· ${birthPlace}`}
                </span>
              </div>
            </div>
          )}

          {(series || num) && (
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Паспорт РФ:</span>
                <span className="font-mono font-bold text-slate-900 text-xs">
                  серия {series} № {num}
                </span>
              </div>
              {issuedBy && (
                <div className="text-[11px] text-slate-600">
                  <span className="text-slate-400">Выдан:</span> {issuedBy}
                </div>
              )}
              {(issueDate || depCode) && (
                <div className="text-[11px] text-slate-500 flex items-center gap-3">
                  {issueDate && <span>Дата: {issueDate}</span>}
                  {depCode && <span>Код подразделения: {depCode}</span>}
                </div>
              )}
            </div>
          )}

          {regAddress && (
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <p className="text-slate-400 text-[10px] uppercase font-bold mb-0.5">
                Адрес регистрации
              </p>
              <p className="text-slate-800 font-medium leading-relaxed">{regAddress}</p>
            </div>
          )}

          {(licenseUntil || experienceFrom) && (
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-slate-400 font-medium">Водительское удостоверение:</span>{' '}
                <span className="font-semibold text-slate-800">
                  {licenseUntil ? `до ${licenseUntil}` : ''}
                  {experienceFrom ? ` (стаж с ${experienceFrom} г.)` : ''}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={copyAll}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span>📋</span>
            <span>{copied ? 'Скопировано!' : 'Скопировать данные'}</span>
          </button>
          <button
            onClick={onClose}
            className="text-xs font-semibold px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
