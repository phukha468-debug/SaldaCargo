import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { ScrollOnFocus } from '@/components/scroll-on-focus';
import { MinimizeOnBack } from '@/components/minimize-on-back';

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'TK501',
  description: 'Транспортная компания TK501 — Верхняя Салда',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TK501',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* MAX Messenger official SDK — load synchronously before anything else */}
        <script src="https://st.max.ru/js/max-web-app.js" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (window.WebApp && typeof window.WebApp.ready === 'function') {
                  window.WebApp.ready();
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased bg-zinc-50" suppressHydrationWarning>
        <Providers>
          <MinimizeOnBack />
          <ScrollOnFocus />
          {children}
        </Providers>
      </body>
    </html>
  );
}
