"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { 
  Button, 
  Input, 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@saldacargo/ui"

const orderSchema = z.object({
  clientName: z.string().min(2, "Введите имя клиента"),
  amount: z.coerce.number().min(1, "Сумма должна быть больше 0"),
  paymentMethod: z.enum(["cash", "qr", "invoice", "debt", "card"]),
})

type OrderFormValues = z.infer<typeof orderSchema>

export function OrderForm({ onSubmit, onClose }: { onSubmit: (values: OrderFormValues) => void, onClose: () => void }) {
  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      clientName: "",
      amount: 0,
      paymentMethod: "cash",
    }
  })

  return (
    <div className="flex flex-col gap-6 py-4">
      <DialogHeader>
        <DialogTitle>Новый заказ</DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
           <label className="text-sm font-bold text-accent-secondary uppercase">Клиент</label>
           <Input {...form.register("clientName")} placeholder="Например: Петрович" />
           {form.formState.errors.clientName && <p className="text-xs text-error">{form.formState.errors.clientName.message}</p>}
        </div>

        <div className="flex flex-col gap-2">
           <label className="text-sm font-bold text-accent-secondary uppercase">Сумма заказа</label>
           <Input type="number" {...form.register("amount")} placeholder="0" className="text-2xl font-bold tabular-nums h-16 text-center" />
           {form.formState.errors.amount && <p className="text-xs text-error">{form.formState.errors.amount.message}</p>}
        </div>

        <div className="flex flex-col gap-2">
           <label className="text-sm font-bold text-accent-secondary uppercase">Способ оплаты</label>
           <Select defaultValue="cash" onValueChange={(val: any) => form.setValue("paymentMethod", val)}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите способ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Наличные 💵</SelectItem>
                <SelectItem value="qr">QR-код 📱</SelectItem>
                <SelectItem value="card">Карта 💳</SelectItem>
                <SelectItem value="invoice">Счёт 🏦</SelectItem>
                <SelectItem value="debt">В долг ⏳</SelectItem>
              </SelectContent>
           </Select>
        </div>
      </div>

      <DialogFooter className="mt-8 flex flex-col gap-3">
        <Button className="w-full h-14 text-lg font-bold" onClick={form.handleSubmit(onSubmit)}>
          СОХРАНИТЬ ЗАКАЗ
        </Button>
        <Button variant="ghost" className="w-full" onClick={onClose}>
          Отмена
        </Button>
      </DialogFooter>
    </div>
  )
}
