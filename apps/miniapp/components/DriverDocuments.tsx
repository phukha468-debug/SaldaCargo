'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export function DriverDocuments({ driverId }: { driverId: string }) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [emailModal, setEmailModal] = useState<{ isOpen: boolean; docUrl: string; docName: string } | null>(null);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const webUrl = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000';
      const res = await fetch(`${webUrl}/api/driver-documents/list?driverId=${driverId}`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDocuments();
  }, [driverId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const webUrl = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000';
      const formData = new FormData();
      formData.append('file', file);
      formData.append('driverId', driverId);

      const res = await fetch(`${webUrl}/api/driver-documents/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      await fetchDocuments();
    } catch (err: any) {
      alert(`Ошибка: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (filePath: string) => {
    try {
      const webUrl = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000';
      const res = await fetch(`${webUrl}/api/driver-documents/url?filePath=${encodeURIComponent(filePath)}&expiresIn=60`);
      const data = await res.json();
      if (data.url) window.open(data.url, '_blank');
    } catch (err) {}
  };

  const openEmailModal = async (filePath: string, fileName: string) => {
    try {
      const webUrl = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000';
      const res = await fetch(`${webUrl}/api/driver-documents/url?filePath=${encodeURIComponent(filePath)}&expiresIn=3600`);
      const data = await res.json();
      if (data.url) {
        setEmailModal({ isOpen: true, docUrl: data.url, docName: fileName });
      }
    } catch (err) {}
  };

  const handleSendEmail = async () => {
    if (!emailModal || !email) return;
    setSending(true);
    try {
      // Идём на API в Web, т.к. там настроен Resend, либо делаем абсолютный URL
      const webUrl = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000';
      const res = await fetch(`${webUrl}/api/driver-documents/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, fileUrl: emailModal.docUrl, fileName: emailModal.docName }),
      });
      if (!res.ok) throw new Error('Ошибка отправки');
      alert('Успешно отправлено!');
      setEmailModal(null);
      setEmail('');
    } catch (err: any) {
      alert(`Ошибка отправки: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string, filePath: string) => {
    if (!confirm('Удалить?')) return;
    try {
      const webUrl = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000';
      const res = await fetch(`${webUrl}/api/driver-documents/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, filePath }),
      });
      if (res.ok) fetchDocuments();
    } catch (err) {}
  };

  return (
    <div className="mt-4 pt-4 border-t border-slate-100">
      <h3 className="text-sm font-bold text-slate-900 mb-3">Документы</h3>
      
      <label className="block w-full bg-slate-100 text-slate-700 text-xs font-bold text-center px-4 py-3 rounded-xl mb-4">
        {uploading ? 'Загрузка...' : '+ Загрузить документ'}
        <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleUpload} disabled={uploading}/>
      </label>

      {loading ? <p className="text-xs text-slate-400">Загрузка...</p> : documents.length === 0 ? <p className="text-xs text-slate-400">Нет документов</p> : (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li key={doc.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col gap-2">
              <span className="text-xs font-medium text-slate-700 truncate">{doc.file_name}</span>
              <div className="flex gap-2">
                <button onClick={() => handleDownload(doc.file_path)} className="flex-1 text-[10px] bg-white border border-slate-200 px-2 py-1.5 rounded-lg text-slate-600">
                  Открыть
                </button>
                <button onClick={() => openEmailModal(doc.file_path, doc.file_name)} className="flex-1 text-[10px] bg-white border border-slate-200 px-2 py-1.5 rounded-lg text-slate-600">
                  Отправить
                </button>
                <button onClick={() => handleDelete(doc.id, doc.file_path)} className="w-8 text-[10px] text-rose-500 bg-rose-50 rounded-lg">×</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {emailModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full p-5">
            <h4 className="font-bold text-slate-900 mb-2">Отправить документ</h4>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded-xl px-3 py-3 text-sm mb-4"
            />
            <div className="flex gap-2">
              <button onClick={handleSendEmail} disabled={sending || !email} className="flex-1 bg-blue-600 text-white text-xs font-bold py-3 rounded-xl">
                {sending ? 'Отправка...' : 'Отправить'}
              </button>
              <button onClick={() => { setEmailModal(null); setEmail(''); }} className="flex-1 bg-slate-100 text-slate-700 text-xs font-bold py-3 rounded-xl">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
