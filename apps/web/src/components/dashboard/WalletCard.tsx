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
    <div className="bg-[#EEF2F8] rounded-xl border border-slate-300/70 p-6 shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-[14px] text-slate-800">Деньги</h3>
        <span className="text-[17px] font-extrabold text-slate-800 font-mono tabular-nums">
          {fmt(total)} ₽
        </span>
      </div>
      <div className="flex flex-col gap-3 flex-1 justify-evenly">
        {wallets.map(w => (
          <div key={w.id} className="flex justify-between items-center">
            <span className="text-[13px] text-slate-500">{w.name}</span>
            <span className={`text-[14px] font-semibold font-mono tabular-nums ${
              w.balance < 0 ? 'text-red-600' : 'text-slate-800'
            }`}>
              {fmt(w.balance)} ₽
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
