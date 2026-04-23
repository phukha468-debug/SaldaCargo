import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from "@saldacargo/ui"

export const metadata: Metadata = {
  title: 'SaldaCargo — Водитель',
  description: 'Путевые листы и рейсы',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="bg-slate-50 min-h-screen max-w-md mx-auto">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
