import { useNavigate } from 'react-router-dom'
import { Upload, Wallet, UserPlus, Users, BarChart3 } from 'lucide-react'
import { Button } from '@shared/components/ui/button'

const ACTIONS = [
  { label: 'استيراد فاتورة', icon: Upload, to: '/invoices' },
  { label: 'تسجيل دفعة', icon: Wallet, to: '/suppliers' },
  { label: 'إضافة مورد', icon: UserPlus, to: '/suppliers' },
  { label: 'عرض الموردين', icon: Users, to: '/suppliers' },
  { label: 'التقارير', icon: BarChart3, to: '/reports' }
] as const

/** Plain navigation shortcuts — no cross-module dialog state, just routing. */
export function QuickActionsBar() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-wrap gap-2">
      {ACTIONS.map((action) => (
        <Button key={action.label} variant="outline" size="sm" onClick={() => navigate(action.to)}>
          <action.icon className="size-4" />
          {action.label}
        </Button>
      ))}
    </div>
  )
}
