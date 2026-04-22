import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { Layout } from './components/Layout';
import { DriverHome } from './components/driver/DriverHome';
import { WebDashboard } from './components/admin/WebDashboard';
import { LogIn } from 'lucide-react';

function AppContent() {
  const { user, profile, loading, login, activeRole } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-workspace">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-blue"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-workspace p-6">
        <div className="bg-white p-8 rounded-[8px] border border-[#E5E7EB] shadow-sm max-w-sm w-full text-center">
          <h1 className="text-2xl font-bold mb-6 text-navigation">SaldaCargo</h1>
          <p className="text-accent-gray mb-8">Система управления автопарком. Пожалуйста, войдите в систему.</p>
          <button 
            onClick={() => login()}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <LogIn size={20} />
            Войти через Google
          </button>
        </div>
      </div>
    );
  }

  const isWebRole = ['admin', 'owner', 'accountant', 'dispatcher', 'mechanic_lead'].includes(activeRole || '');
  const isMiniAppRole = ['driver', 'loader', 'mechanic'].includes(activeRole || '');

  return (
    <Layout>
      {isMiniAppRole && <DriverHome />}
      {isWebRole && <WebDashboard />}
      {!isWebRole && !isMiniAppRole && (
        <div className="p-6 text-center">
          <h2 className="text-xl font-semibold">Доступ ограничен</h2>
          <p className="text-accent-gray">Ваша роль ({activeRole}) пока не поддерживается в этом интерфейсе.</p>
        </div>
      )}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
