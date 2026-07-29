import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@shared/components/ui/dialog'
import { useDeleteSupplier } from '../hooks/useSupplierMutations'

interface DeleteSupplierDialogProps {
  supplierId: number
  supplierName: string
  balance: number
}

/**
 * Only meant for a supplier created by mistake — the backend also enforces
 * zero balance and zero invoice/transaction history (see routes/suppliers.js
 * DELETE /:id), this disabled state is just the UI-side hint.
 */
export function DeleteSupplierDialog({ supplierId, supplierName, balance }: DeleteSupplierDialogProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const deleteSupplier = useDeleteSupplier(supplierId)
  const disabled = balance !== 0

  function handleConfirm() {
    deleteSupplier.mutate(undefined, {
      onSuccess: () => {
        setOpen(false)
        navigate('/suppliers')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="text-destructive hover:text-destructive"
          disabled={disabled}
          title={disabled ? 'لا يمكن حذف مورد رصيده ليس صفراً' : undefined}
        >
          <Trash2 className="size-4" />
          حذف المورد
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>حذف المورد «{supplierName}»</DialogTitle>
          <DialogDescription>هذا الإجراء نهائي ولا يمكن التراجع عنه.</DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-xs text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            سيتم حذف المورد «{supplierName}» نهائياً. هذا متاح فقط لمورد لم يُستخدم إطلاقاً — بلا فواتير أو دفعات أو
            تسويات مسجلة. إذا كان لدى هذا المورد أي سجل، ستفشل عملية الحذف.
          </span>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            إلغاء
          </Button>
          <Button type="button" variant="destructive" onClick={handleConfirm} disabled={deleteSupplier.isPending}>
            {deleteSupplier.isPending ? 'جاري الحذف...' : 'تأكيد الحذف'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
