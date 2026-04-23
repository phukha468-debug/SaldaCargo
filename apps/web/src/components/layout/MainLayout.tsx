import { TopNav } from "./TopNav"

interface MainLayoutProps {
  children: React.ReactNode
  fullHeight?: boolean
}

export default function MainLayout({ children, fullHeight }: MainLayoutProps) {
  return (
    <div className="flex flex-col h-screen bg-workspace overflow-hidden">
      <TopNav />
      <main className={`flex-1 ${fullHeight ? 'overflow-hidden flex flex-col' : 'overflow-auto'}`}>
        <div className={`p-8 max-w-7xl mx-auto w-full ${fullHeight ? 'h-full flex flex-col' : 'min-h-full'}`}>
          {children}
        </div>
      </main>
    </div>
  )
}
