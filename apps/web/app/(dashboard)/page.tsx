'use client';

import Link from 'next/link';

const navigationCards = [
  {
    href: '/ati',
    title: 'АТИ Перевозки',
    subtitle: 'Канбан договоров-заявок, 8 этапов, ЭТрН, Почта РФ и дебиторка',
    icon: '🚚',
    badge: 'АТИ',
    badgeColor: 'bg-amber-400 text-slate-900 border-slate-900',
    cardBg: 'bg-white',
  },
  {
    href: '/review',
    title: 'Ревью рейсов',
    subtitle: 'Проверка одометров, закрытие рейсов',
    icon: '📋',
    badge: 'Рейсы',
    badgeColor: 'bg-amber-400 text-slate-900 border-slate-900',
    cardBg: 'bg-amber-100/70',
  },
  {
    href: '/finance',
    title: 'Финансы / P&L',
    subtitle: 'Касса, расчетный счет, кредиты и сальдо',
    icon: '💰',
    badge: 'P&L',
    badgeColor: 'bg-sky-300 text-slate-900 border-slate-900',
    cardBg: 'bg-white',
  },
  {
    href: '/fleet',
    title: 'Автопарк',
    subtitle: 'Газели, Валдай, страховки и ТО',
    icon: '🚛',
    badge: '12 авто',
    badgeColor: 'bg-blue-300 text-slate-900 border-slate-900',
    cardBg: 'bg-white',
  },
  {
    href: '/garage',
    title: 'Гараж / СТО',
    subtitle: 'Заказ-наряды на ремонт и запчасти',
    icon: '🔧',
    badge: 'СТО',
    badgeColor: 'bg-purple-300 text-slate-900 border-slate-900',
    cardBg: 'bg-purple-100/70',
  },
  {
    href: '/counterparties',
    title: 'Контрагенты',
    subtitle: 'Магазины, заводы, акты сверки и долги',
    icon: '🏢',
    badge: 'B2B',
    badgeColor: 'bg-rose-300 text-slate-900 border-slate-900',
    cardBg: 'bg-white',
  },
  {
    href: '/staff',
    title: 'Персонал',
    subtitle: 'Водители, грузчики, ведомости зарплат',
    icon: '👷',
    badge: 'Штат',
    badgeColor: 'bg-teal-300 text-slate-900 border-slate-900',
    cardBg: 'bg-white',
  },
  {
    href: '/retro',
    title: 'Ретро-ввод',
    subtitle: 'Внесение архивных рейсов и оплат',
    icon: '⏳',
    badge: 'Архив',
    badgeColor: 'bg-orange-300 text-slate-900 border-slate-900',
    cardBg: 'bg-white',
  },
] as const;

export default function DashboardHome() {
  return (
    <div className="h-full flex flex-col justify-center max-w-7xl mx-auto w-full">
      {/* Сетка 4x2 строго в пределах экрана без скролла */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 h-full max-h-[calc(100vh-140px)]">
        {navigationCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className={`rounded-2xl p-4 sm:p-5 flex flex-col justify-between border-[2.5px] border-slate-900 shadow-[4px_4px_0px_#0f172a] hover:shadow-[7px_7px_0px_#0f172a] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0px_#0f172a] transition-all duration-150 cursor-pointer group ${card.cardBg}`}
          >
            {/* Верхняя часть карточки: иконка + бейдж */}
            <div className="flex items-start justify-between">
              <span className="text-4xl sm:text-5xl group-hover:scale-110 transition-transform duration-150 select-none">
                {card.icon}
              </span>
              <span
                className={`border-2 font-black text-[10px] uppercase px-2 py-0.5 shadow-[1.5px_1.5px_0px_#000] rounded ${card.badgeColor}`}
              >
                {card.badge}
              </span>
            </div>

            {/* Средняя часть: Название и описание */}
            <div className="my-auto py-1">
              <h2 className="text-base sm:text-lg lg:text-xl font-black uppercase text-slate-900 leading-tight">
                {card.title}
              </h2>
              <p className="text-[11px] sm:text-xs font-bold text-slate-600 mt-1 line-clamp-1">
                {card.subtitle}
              </p>
            </div>

            {/* Нижняя часть: Кнопка действия */}
            <div className="font-black text-xs uppercase text-slate-900 flex items-center justify-between pt-2.5 border-t-2 border-slate-900">
              <span className="tracking-wider">Войти в раздел</span>
              <span className="text-sm group-hover:translate-x-1 transition-transform">➔</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
