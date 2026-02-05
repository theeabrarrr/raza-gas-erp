'use client'

import { useState } from 'react'
import {
    generateDailySalesReport,
    generateMonthlySummary,
    generateProfitLossStatement,
    getOutstandingBalancesReport
} from '@/app/actions/reportActions'
import { generateSalesReportPDF, generateMonthlyReportPDF, generateOutstandingBalancesPDF } from '@/lib/utils/pdfExport'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Download, Calendar, TrendingUp, DollarSign } from 'lucide-react'

// Define interfaces for report data to avoid 'any'
interface FinancialReportData {
    totalOrders?: number;
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    profitMargin?: number;
    cashCollected?: number;
    completedOrders?: number;
    expensesByCategory?: Record<string, number>;
    customerCount?: number;
    customers?: any[];
    [key: string]: any;
}

export default function FinanceReportsPage() {
    const [reportType, setReportType] = useState<string>('daily')
    const [reportData, setReportData] = useState<FinancialReportData | null>(null)
    const [loading, setLoading] = useState(false)
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
    const [selectedMonth, setSelectedMonth] = useState(
        new Date().toISOString().slice(0, 7)
    )
    const [dateRange, setDateRange] = useState({
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    })

    const generateReport = async () => {
        setLoading(true)
        let result: any

        try {
            switch (reportType) {
                case 'daily':
                    result = await generateDailySalesReport(selectedDate)
                    break
                case 'monthly':
                    result = await generateMonthlySummary(selectedMonth)
                    break
                case 'profitloss':
                    result = await generateProfitLossStatement(dateRange)
                    break
                case 'outstanding':
                    result = await getOutstandingBalancesReport()
                    break
                default:
                    return
            }

            if (result.success) {
                setReportData(result.data)
            } else {
                alert('Error generating report: ' + result.error) // Using alert is simple, could be replaced by toast
            }
        } catch (e: any) {
            console.error("Report generation failed", e);
            alert('An unexpected error occurred.')
        } finally {
            setLoading(false)
        }
    }

    const downloadCSV = () => {
        if (!reportData) return

        // Convert report data to CSV (Primitive but effective)
        let csv = ''
        try {
            const data = reportType === 'outstanding' && reportData.customers ? reportData.customers : [reportData]

            if (!data || data.length === 0) {
                alert("No data to export");
                return;
            }

            // Get header keys from first object, filtering out complex objects if any
            const keys = Object.keys(data[0]).filter(key => typeof data[0][key] !== 'object' || data[0][key] === null);

            // Header
            csv += keys.join(',') + '\n'

            // Rows
            data.forEach((row: any) => {
                csv += keys.map(k => {
                    const val = row[k];
                    if (val === null || val === undefined) return '';
                    // Escape commas in strings
                    if (typeof val === 'string' && val.includes(',')) return `"${val}"`;
                    return val;
                }).join(',') + '\n'
            })

            // Download
            const blob = new Blob([csv], { type: 'text/csv' })
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${reportType}_report_${Date.now()}.csv`
            a.click()
        } catch (e) {
            console.error("CSV Export Error", e);
            alert("Failed to export CSV");
        }
    }

    return (
        <div className="p-6 space-y-6 pb-20">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-slate-900">Financial Reports</h1>
            </div>

            {/* Report Configuration */}
            <Card>
                <CardHeader>
                    <CardTitle>Generate Report</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="reportType">Report Type</Label>
                            <Select value={reportType} onValueChange={(val) => {
                                setReportType(val);
                                setReportData(null); // Clear data on type change
                            }}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="daily">Daily Sales Report</SelectItem>
                                    <SelectItem value="monthly">Monthly Summary</SelectItem>
                                    <SelectItem value="profitloss">Profit & Loss Statement</SelectItem>
                                    <SelectItem value="outstanding">Outstanding Balances</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {reportType === 'daily' && (
                            <div>
                                <Label htmlFor="date">Date</Label>
                                <Input
                                    id="date"
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                />
                            </div>
                        )}

                        {reportType === 'monthly' && (
                            <div>
                                <Label htmlFor="month">Month</Label>
                                <Input
                                    id="month"
                                    type="month"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                />
                            </div>
                        )}

                        {reportType === 'profitloss' && (
                            <>
                                <div>
                                    <Label htmlFor="startDate">Start Date</Label>
                                    <Input
                                        id="startDate"
                                        type="date"
                                        value={dateRange.startDate}
                                        onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="endDate">End Date</Label>
                                    <Input
                                        id="endDate"
                                        type="date"
                                        value={dateRange.endDate}
                                        onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    <div className="flex gap-2">
                        <Button onClick={generateReport} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
                            {loading ? 'Generating...' : 'Generate Report'}
                        </Button>
                        {reportData && (
                            <>
                                <Button variant="outline" onClick={downloadCSV}>
                                    <Download className="w-4 h-4 mr-2" />
                                    Export CSV
                                </Button>
                                <Button variant="outline" onClick={() => {
                                    if (reportType === 'daily') {
                                        generateSalesReportPDF(reportData, selectedDate)
                                    } else if (reportType === 'monthly') {
                                        generateMonthlyReportPDF(reportData, selectedMonth)
                                    } else if (reportType === 'outstanding') {
                                        generateOutstandingBalancesPDF(reportData)
                                    }
                                }}>
                                    <Download className="w-4 h-4 mr-2" />
                                    Export PDF
                                </Button>
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Report Results */}
            {reportData && (
                <div className="space-y-4 animate-in fade-in duration-500">
                    {/* Summary Cards */}
                    {(reportType === 'daily' || reportType === 'monthly' || reportType === 'profitloss') && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {/* Daily specific */}
                            {reportData.totalOrders !== undefined && (
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm text-slate-500 font-medium">Total Orders</p>
                                                <p className="text-2xl font-bold text-slate-900">{reportData.totalOrders}</p>
                                            </div>
                                            <Calendar className="h-8 w-8 text-blue-500 opacity-80" />
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            <Card>
                                <CardContent className="pt-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-slate-500 font-medium">Total Revenue</p>
                                            <p className="text-2xl font-bold text-emerald-600">
                                                Rs {reportData.totalRevenue?.toLocaleString()}
                                            </p>
                                        </div>
                                        <DollarSign className="h-8 w-8 text-emerald-500 opacity-80" />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="pt-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-slate-500 font-medium">Total Expenses</p>
                                            <p className="text-2xl font-bold text-rose-600">
                                                Rs {reportData.totalExpenses?.toLocaleString()}
                                            </p>
                                        </div>
                                        <TrendingUp className="h-8 w-8 text-rose-500 opacity-80" />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="pt-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-slate-500 font-medium">Net Profit</p>
                                            <p className={`text-2xl font-bold ${reportData.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                Rs {reportData.netProfit?.toLocaleString()}
                                            </p>
                                        </div>
                                        <TrendingUp className={`h-8 w-8 ${reportData.netProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'} opacity-80`} />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Additional Monthly Metric */}
                    {reportType === 'monthly' && reportData.profitMargin !== undefined && (
                        <div className="grid grid-cols-1">
                            <Card>
                                <CardContent className="pt-6 flex justify-between items-center">
                                    <span className="font-medium text-slate-500">Profit Margin</span>
                                    <span className="text-xl font-bold text-slate-900">{reportData.profitMargin.toFixed(2)}%</span>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Charts */}
                    {(reportType === 'monthly' || reportType === 'profitloss') && reportData.expensesByCategory && Object.keys(reportData.expensesByCategory).length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Expenses by Category</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={Object.entries(reportData.expensesByCategory).map(([category, amount]) => ({
                                            category,
                                            amount
                                        }))}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                            <XAxis dataKey="category" tickLine={false} axisLine={false} />
                                            <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `Rs ${value}`} />
                                            <Tooltip
                                                formatter={(value: number | undefined) => [value ? `Rs ${value.toLocaleString()}` : '0', 'Amount']}
                                                cursor={{ fill: '#F1F5F9' }}
                                            />
                                            <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Outstanding Balances Table */}
                    {reportType === 'outstanding' && reportData.customers && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Outstanding Balances ({reportData.customerCount} customers)</CardTitle>
                                <p className="text-sm text-slate-500">Total Outstanding: Rs {reportData.totalOutstanding?.toLocaleString()}</p>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto rounded-md border border-slate-100">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50">
                                            <tr className="border-b border-slate-100">
                                                <th className="text-left p-3 font-semibold text-slate-600">Customer</th>
                                                <th className="text-left p-3 font-semibold text-slate-600">Phone</th>
                                                <th className="text-right p-3 font-semibold text-slate-600">Balance</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {reportData.customers.map((customer: any) => (
                                                <tr key={customer.id} className="hover:bg-slate-50/50">
                                                    <td className="p-3 font-medium text-slate-900">{customer.name}</td>
                                                    <td className="p-3 text-slate-500">{customer.phone}</td>
                                                    <td className="p-3 text-right font-bold text-rose-600">
                                                        Rs {customer.balance?.toLocaleString() || 0}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}
        </div>
    )
}
