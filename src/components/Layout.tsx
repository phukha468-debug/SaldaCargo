import React from 'react';
import { useAuth } from '../lib/AuthContext';
import { UserRole } from '../types';
import { Settings, LogOut, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '../lib/utils';

export function Layout({ children }: { children: React.ReactNode }) {
  const { profile, activeRole, setActiveRole, logout } = useAuth();
  const [showRoleMenu, setShowRoleMenu] = React.useState(false);

  const roleNames: Record<UserRole, string> = {
    driver: 'Я водитель',
    loader: 'Я грузчик',
    mechanic: 'Я механик',
    mechanic_lead: 'Я ст. механик',
    dispatcher: 'Диспетчер',
    accountant: 'Бухгалтер',
    admin: 'Админ',
    owner: 'Владелец',
  };

  const isWebApp = activeRole === 'admin' || activeRole === 'owner' || activeRole === 'accountant' || activeRole === 'dispatcher';

  return (
    <div className="min-h-screen flex flex-col bg-workspace">
      {/* Header - Only for MiniApp users */}
      {!isWebApp && (
        <header className="bg-navigation h-[56px] px-4 flex items-center justify-between sticky top-0 z-50 shadow-md">
          <div className="flex items-center gap-3">
            <div className="text-white font-bold text-lg">SaldaCargo</div>
            <div className="text-[#F5F5F0]/60 text-sm hidden sm:block">
              {format(new Date(), 'd MMMM', { locale: ru })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {profile && profile.roles.length > 1 && (
              <div className="relative">
                <button 
                  onClick={() => setShowRoleMenu(!showRoleMenu)}
                  className="bg-white/10 text-white px-3 py-1 rounded-[4px] flex items-center gap-1 text-sm font-medium hover:bg-white/20 transition-colors"
                  id="role-switcher"
                >
                  {roleNames[activeRole || 'driver']}
                  <ChevronDown size={14} className={cn("transition-transform", showRoleMenu && "rotate-180")} />
                </button>
                
                {showRoleMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-[8px] shadow-lg border border-[#E5E7EB] py-1 z-[60]">
                    {profile.roles.map(role => (
                      <button
                        key={role}
                        onClick={() => {
                          setActiveRole(role);
                          setShowRoleMenu(false);
                        }}
                        className={cn(
                          "w-full text-left px-4 py-2 text-sm hover:bg-workspace transition-colors",
                          activeRole === role ? "text-accent-blue font-semibold" : "text-navigation"
                        )}
                      >
                        {roleNames[role]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            <button className="text-white/80 hover:text-white p-2">
              <Settings size={20} />
            </button>
            
            <button 
              onClick={() => logout()}
              className="text-white/80 hover:text-white p-2"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className={cn(
        "flex-1 overflow-auto pb-safe",
        isWebApp && "h-screen" // Let WebApp handle its own scroll
      )}>
        {/* Mobile role switcher for WebApp mode if screen small?? No, WebApp roles usually use desktop */}
        {isWebApp && (
          <div className="fixed top-4 right-4 z-[100] lg:hidden">
             {/* Small floating role switcher for dev/mobile testing of web app */}
             <button 
                onClick={() => setShowRoleMenu(!showRoleMenu)}
                className="bg-navigation text-white p-2 rounded-full shadow-lg"
             >
                <Settings size={20} />
             </button>
             {showRoleMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-[8px] shadow-lg border border-[#E5E7EB] py-1">
                   {profile?.roles.map(role => (
                      <button key={role} onClick={() => { setActiveRole(role); setShowRoleMenu(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-workspace">{roleNames[role]}</button>
                   ))}
                   <button onClick={() => logout()} className="w-full text-left px-4 py-2 text-sm text-accent-red hover:bg-workspace">Выход</button>
                </div>
             )}
          </div>
        )}
        {children}
      </main>

      {/* Bottom Navigation (for Mobile Mini App) */}
      {!isWebApp && activeRole === 'driver' && (
        <nav className="bg-white border-t border-[#E5E7EB] h-14 flex items-center justify-around sticky bottom-0 z-50">
          <button className="flex flex-col items-center justify-center gap-1 text-accent-blue" id="nav-home">
            <div className="h-1 w-1 bg-accent-blue absolute top-0 rounded-full" />
            <div className="w-6 h-6 flex justify-center">🏠</div>
            <span className="text-[10px] uppercase font-bold">Главная</span>
          </button>
          <button className="flex flex-col items-center justify-center gap-1 text-accent-gray" id="nav-trips">
            <div className="w-6 h-6 flex justify-center">📋</div>
            <span className="text-[10px] uppercase font-bold">Рейсы</span>
          </button>
          <button className="flex flex-col items-center justify-center gap-1 text-accent-gray" id="nav-wallet">
            <div className="w-6 h-6 flex justify-center">💰</div>
            <span className="text-[10px] uppercase font-bold">Деньги</span>
          </button>
          <button className="flex flex-col items-center justify-center gap-1 text-accent-gray" id="nav-settings">
            <div className="w-6 h-6 flex justify-center">⚙️</div>
            <span className="text-[10px] uppercase font-bold">Настройки</span>
          </button>
        </nav>
      )}
    </div>
  );
}
