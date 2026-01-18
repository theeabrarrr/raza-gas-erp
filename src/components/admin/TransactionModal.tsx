"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { CalendarIcon, Loader2, Plus, ArrowRight } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
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
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { toast } from "sonner"
import { createTransaction, getAllCustomersClient } from "@/app/actions/financeActions"

// Schema
const formSchema = z.object({
    type: z.enum(["income", "expense"]),
    category: z.string().min(1, "Please select a category"),
    amount: z.coerce.number().min(1, "Amount must be greater than 0"),
    customerId: z.string().optional(),
    description: z.string().min(3, "Description is required"),
    date: z.date()
}).refine(data => {
    if (data.category === 'customer_payment' && !data.customerId) {
        return false;
    }
    return true;
}, {
    message: "Customer is required for payments",
    path: ["customerId"]
});

type TransactionFormValues = z.infer<typeof formSchema>;

export function TransactionModal() {
    const [open, setOpen] = useState(false)
    const [customers, setCustomers] = useState<{ id: string, name: string }[]>([])
    const [loadingCustomers, setLoadingCustomers] = useState(false)

    const form = useForm<TransactionFormValues>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            type: "expense",
            category: "operational_expense",
            amount: 0,
            description: "",
            date: new Date(),
        },
    })

    const type = form.watch("type")
    const category = form.watch("category")

    // Fetch Customers if needed
    useEffect(() => {
        if (category === 'customer_payment') {
            setLoadingCustomers(true);
            getAllCustomersClient().then(res => {
                if (res.data) setCustomers(res.data);
                setLoadingCustomers(false);
            });
        }
    }, [category]);

    // Auto-switch type based on category
    useEffect(() => {
        if (category === 'customer_payment' || category === 'deposit' || category === 'owner_equity') {
            form.setValue('type', 'income');
        } else if (category === 'operational_expense' || category === 'owner_withdrawal' || category === 'maintenance') {
            form.setValue('type', 'expense');
        }
    }, [category, form]);

    async function onSubmit(values: TransactionFormValues) {
        try {
            const formData = new FormData();
            formData.append('type', values.type);
            formData.append('category', values.category);
            formData.append('amount', values.amount.toString());
            formData.append('description', values.description);
            formData.append('date', values.date.toISOString());
            if (values.customerId) formData.append('customer_id', values.customerId);

            const result = await createTransaction(formData);

            if (result.error) {
                toast.error(result.error);
            } else {
                toast.success("Transaction recorded successfully");
                setOpen(false);
                form.reset();
            }
        } catch (error) {
            toast.error("An unexpected error occurred");
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                    <Plus size={16} /> New Entry
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Manual Transaction</DialogTitle>
                    <DialogDescription>
                        Record a manual expense, deposit, or customer payment directly to the ledger.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">

                        {/* Type Toggle */}
                        <div className="flex gap-4 p-1 bg-slate-100 rounded-lg">
                            <button
                                type="button"
                                onClick={() => form.setValue("type", "income")}
                                className={cn(
                                    "flex-1 py-1.5 text-sm font-bold rounded-md transition-all",
                                    type === "income" ? "bg-white text-emerald-600 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-700"
                                )}
                            >
                                Income (+)
                            </button>
                            <button
                                type="button"
                                onClick={() => form.setValue("type", "expense")}
                                className={cn(
                                    "flex-1 py-1.5 text-sm font-bold rounded-md transition-all",
                                    type === "expense" ? "bg-white text-rose-600 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-700"
                                )}
                            >
                                Expense (-)
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="category"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Category</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select Category" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="customer_payment">Customer Payment</SelectItem>
                                                <SelectItem value="deposit">General Deposit</SelectItem>
                                                <SelectItem value="owner_equity">Owner Investment</SelectItem>
                                                <SelectItem value="operational_expense">Operational Expense</SelectItem>
                                                <SelectItem value="maintenance">Maintenance</SelectItem>
                                                <SelectItem value="salary">Salary Advance</SelectItem>
                                                <SelectItem value="owner_withdrawal">Owner Withdrawal</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="amount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Amount (Rs)</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} className={cn("font-mono text-right font-bold", type === 'income' ? 'text-emerald-600' : 'text-rose-600')} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Conditional Customer Select */}
                        {category === 'customer_payment' && (
                            <FormField
                                control={form.control}
                                name="customerId"
                                render={({ field }) => (
                                    <FormItem className="animate-in fade-in slide-in-from-top-2">
                                        <FormLabel>Select Customer</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger disabled={loadingCustomers}>
                                                    <SelectValue placeholder={loadingCustomers ? "Loading..." : "Select Customer"} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {customers.map(c => (
                                                    <SelectItem key={c.id} value={c.id}>
                                                        {c.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description / Note</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. Tea for Staff, Bill #123" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="date"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Date</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn(
                                                        "w-full pl-3 text-left font-normal",
                                                        !field.value && "text-muted-foreground"
                                                    )}
                                                >
                                                    {field.value ? (
                                                        format(field.value, "PPP")
                                                    ) : (
                                                        <span>Pick a date</span>
                                                    )}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={field.value}
                                                onSelect={field.onChange}
                                                disabled={(date) =>
                                                    date > new Date() || date < new Date("1900-01-01")
                                                }
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="pt-4 flex gap-3">
                            <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="flex-1">Cancel</Button>
                            <Button type="submit" className={cn("flex-1 font-bold", type === 'income' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700')} disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {type === 'income' ? 'Record Income' : 'Record Expense'}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
