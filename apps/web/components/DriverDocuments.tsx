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
      const res = await fetch(`/api/driver-documents/list?driverId=${driverId}`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (e) {
      console.error('Fetch docs error', e);
    }
    setLoading(false);

  useEffect(() => {
    fetchDocuments();
  }, [driverId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('driverId', driverId);

      const res = await fetch('/api/driver-documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      await fetchDocuments();
    } catch (err: any) {
      alert(`Ошибка загрузки: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      const res = await fetch(`/api/driver-documents/url?filePath=${encodeURIComponent(filePath)}&expiresIn=60`);
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'Ошибка получения ссылки');
      window.open(data.url, '_blank');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSendEmail = async () => {
    if (!emailModal || !email) return;
    setSending(true);
    try {
      const res = await fetch('/api/driver-documents/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, fileUrl: emailModal.docUrl, fileName: emailModal.docName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert('Успешно отправлено!');
      setEmailModal(null);
      setEmail('');
    } catch (err: any) {
      alert(`Ошибка отправки: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const openEmailModal = async (filePath: string, fileName: string) => {
    try {
      const res = await fetch(`/api/driver-documents/url?filePath=${encodeURIComponent(filePath)}&expiresIn=3600`);
      const data = await res.json();
      if (data.url) {
        setEmailModal({ isOpen: true, docUrl: data.url, docName: fileName });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string, filePath: string) => {
    if (!confirm('Удалить документ?')) return;
    try {
      const res = await fetch('/api/driver-documents/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, filePath }),
      });
      if (!res.ok) throw new Error('Delete failed');
      fetchDocuments();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="mt-6 pt-6 border-t border-slate-100">
      <h3 className="text-sm font-bold text-slate-900 mb-4">Документы водителя</h3>
      
      {/* Upload button */}
      <div className="mb-4">
        <label className="bg-slate-100 text-slate-700 text-xs font-bold px-4 py-2 rounded-lg cursor-pointer hover:bg-slate-200 transition-colors inline-block">
          {uploading ? 'Загрузка...' : '+ Загрузить файл (PDF, JPG)'}
          <input 
            type="file" 
            accept=".pdf,.jpg,.jpeg,.png" 
            className="hidden" 
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {/* Document List */}
      {loading ? (
        <p className="text-xs text-slate-400">Загрузка документов...</p>
      ) : documents.length === 0 ? (
        <p className="text-xs text-slate-400">Документов пока нет</p>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="text-xs font-medium text-slate-700 truncate mr-4" title={doc.file_name}>
                {doc.file_name}
              </span>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => handleDownload(doc.file_path, doc.file_name)} className="text-[10px] bg-white border border-slate-200 px-2 py-1 rounded text-slate-600 hover:text-emerald-600 hover:border-emerald-200 transition-colors">
                  Смотреть
                </button>
                <button onClick={() => openEmailModal(doc.file_path, doc.file_name)} className="text-[10px] bg-white border border-slate-200 px-2 py-1 rounded text-slate-600 hover:text-blue-600 hover:border-blue-200 transition-colors">
                  Отправить
                </button>
                <button onClick={() => handleDelete(doc.id, doc.file_path)} className="text-[10px] text-slate-400 hover:text-rose-500 px-1">
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Email Modal */}
      {emailModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h4 className="font-bold text-slate-900 mb-2">Отправить документ</h4>
            <p className="text-xs text-slate-500 mb-4 truncate">{emailModal.docName}</p>
            <input
              type="email"
              placeholder="Email получателя"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400 mb-4"
            />
            <div className="flex gap-2">
              <button 
                onClick={handleSendEmail} 
                disabled={sending || !email}
                className="flex-1 bg-blue-600 text-white text-xs font-bold py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {sending ? 'Отправка...' : 'Отправить'}
              </button>
              <button 
                onClick={() => { setEmailModal(null); setEmail(''); }}
                className="flex-1 bg-slate-100 text-slate-700 text-xs font-bold py-2 rounded-lg hover:bg-slate-200"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
