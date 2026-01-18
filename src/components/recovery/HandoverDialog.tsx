"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Loader2, ArrowRight } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { processRecoveryHandover } from "@/app/actions/recoveryActions"

const formSchema = z.object({
    amount: z.coerce.number().min(1, "Amount must be greater than 0"),
    receiverId: z.string().min(1, "Select a receiver"),
})

interface HandoverDialogProps {
    currentBalance: number
    receivers: { id: string; name: string; role: string }[]
}

export function HandoverDialog({ currentBalance, receivers }: HandoverDialogProps) {
    const [open, setOpen] = useState(false)

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            amount: currentBalance, // Default to full handover
            receiverId: "",
        },
    })

    async function onSubmit(values: z.infer<typeof formSchema>) {
        const formData = new FormData()
        formData.append("amount", values.amount.toString())
        formData.append("receiver_id", values.receiverId)

        const result = await processRecoveryHandover(formData)

        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success("Handover request sent successfully")
            setOpen(false)
            form.reset({ amount: 0, receiverId: "" }) // Reset 
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="font-bold bg-white text-emerald-900 border border-emerald-200 hover:bg-emerald-50">
                    Handover Cash <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Cash Handover</DialogTitle>
                    <DialogDescription>
                        Transfer collected cash to an Office Admin.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">

                        <div className="p-3 bg-emerald-50 rounded-lg mb-4 text-center">
                            <span className="text-sm text-emerald-800 uppercase font-semibold">Current Wallet Balance</span>
                            <div className="text-3xl font-bold text-emerald-900 mt-1">
                                Rs {currentBalance.toLocaleString()}
                            </div>
                        </div>

                        <FormField
                            control={form.control}
                            name="amount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Amount to Handover</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            {...field}
                                            className="font-bold text-lg"
                                            max={currentBalance} // Native Check
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="receiverId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Select Receiver (Admin)</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Who is taking money?" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {receivers.map((r) => (
                                                <SelectItem key={r.id} value={r.id}>
                                                    {r.name} ({r.role})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter className="mt-4 gap-2">
                            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 font-bold" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Confirm Handover
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
