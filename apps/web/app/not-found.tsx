import Link from 'next/link'
import { Button } from '@saldacargo/ui'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-workspace p-4 text-center">
      <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
      <h2 className="text-2xl font-semibold mb-6">Страница не найдена</h2>
      <p className="text-accent-secondary mb-8 max-w-md">
        Извините, запрашиваемая вами страница не существует или была перенесена.
      </p>
      <Button asChild>
        <Link href="/money-map">
          Вернуться на главную
        </Link>
      </Button>
    </div>
  )
}
