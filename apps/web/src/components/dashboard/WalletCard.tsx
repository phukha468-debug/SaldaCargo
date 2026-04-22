interface Wallet {
  id: string
  code: string
  name: string
  type: string
  balance: number
}

interface WalletCardProps {
  wallets: Wallet[]
  total: number
}

export default function WalletCard({ wallets, total }: WalletCardProps) {
  const fmt = (n: number) => n.toLocaleString('ru-RU')

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-700">💵 Деньги</h3>
        <span className="text-lg font-bold text-slate-800">{fmt(total)} ₽</span>
      </div>
      <div className="space-y-2">
        {wallets.map(w => (
          <div key={w.id} className="flex justify-between items-center text-sm">
            <span className="text-slate-500">{w.name}</span>
            <span className={`font-medium ${w.balance < 0 ? 'text-red-600' : 'text-slate-700'}`}>
              {fmt(w.balance)} ₽
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
