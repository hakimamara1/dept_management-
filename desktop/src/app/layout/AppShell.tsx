import { Outlet } from 'react-router-dom'
import { useExpirationStartupAlerts } from '@modules/expiration'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppShell() {
  useExpirationStartupAlerts()

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background print:h-auto print:w-auto print:overflow-visible">
      <div className="print:hidden">
        <Sidebar />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden print:overflow-visible">
        <div className="print:hidden">
          <Topbar />
        </div>
        <main className="flex flex-1 flex-col overflow-y-auto p-6 print:overflow-visible print:p-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
