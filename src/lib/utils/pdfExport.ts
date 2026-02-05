
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export function generateSalesReportPDF(reportData: any, date: string) {
    const doc = new jsPDF()

    // Header
    doc.setFontSize(20)
    doc.text('Daily Sales Report', 14, 22)
    doc.setFontSize(12)
    doc.text(`Date: ${date}`, 14, 32)

    // Summary
    doc.setFontSize(10)
    doc.text(`Total Orders: ${reportData.totalOrders}`, 14, 45)
    doc.text(`Completed Orders: ${reportData.completedOrders}`, 14, 52)
    doc.text(`Total Revenue: Rs ${reportData.totalRevenue?.toFixed(2) || '0.00'}`, 14, 59)
    doc.text(`Cash Collected: Rs ${reportData.cashCollected?.toFixed(2) || '0.00'}`, 14, 66)
    doc.text(`Total Expenses: Rs ${reportData.totalExpenses?.toFixed(2) || '0.00'}`, 14, 73)
    doc.text(`Net Profit: Rs ${reportData.netProfit?.toFixed(2) || '0.00'}`, 14, 80)

    // Orders table
    if (reportData.orders && reportData.orders.length > 0) {
        autoTable(doc, {
            startY: 90,
            head: [['Order ID', 'Customer', 'Driver', 'Amount', 'Status']],
            body: reportData.orders.map((order: any) => [
                order.id.slice(0, 8),
                order.customer?.name || 'N/A',
                order.driver?.name || 'Unassigned',
                `Rs ${(order.total_amount || order.amount || 0).toFixed(2)}`,
                order.status
            ])
        })
    }

    // Save
    doc.save(`sales_report_${date}.pdf`)
}

export function generateMonthlyReportPDF(reportData: any, month: string) {
    const doc = new jsPDF()

    doc.setFontSize(20)
    doc.text('Monthly Summary Report', 14, 22)
    doc.setFontSize(12)
    doc.text(`Month: ${month}`, 14, 32)

    doc.setFontSize(10)
    doc.text(`Total Orders: ${reportData.totalOrders}`, 14, 45)
    doc.text(`Total Revenue: Rs ${reportData.totalRevenue?.toFixed(2) || '0.00'}`, 14, 52)
    doc.text(`Total Expenses: Rs ${reportData.totalExpenses?.toFixed(2) || '0.00'}`, 14, 59)
    doc.text(`Net Profit: Rs ${reportData.netProfit?.toFixed(2) || '0.00'}`, 14, 66)
    if (reportData.profitMargin !== undefined) {
        doc.text(`Profit Margin: ${reportData.profitMargin.toFixed(2)}%`, 14, 73)
    }

    // Expenses by category
    if (reportData.expensesByCategory) {
        autoTable(doc, {
            startY: 85,
            head: [['Category', 'Amount']],
            body: Object.entries(reportData.expensesByCategory).map(([category, amount]: any) => [
                category,
                `Rs ${amount.toFixed(2)}`
            ])
        })
    }

    doc.save(`monthly_report_${month}.pdf`)
}

export function generateOutstandingBalancesPDF(reportData: any) {
    const doc = new jsPDF()

    doc.setFontSize(20)
    doc.text('Outstanding Balances Report', 14, 22)
    doc.setFontSize(12)
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 32)

    doc.setFontSize(10)
    doc.text(`Total Outstanding: Rs ${reportData.totalOutstanding?.toFixed(2) || '0.00'}`, 14, 45)
    doc.text(`Number of Customers: ${reportData.customerCount}`, 14, 52)
    if (reportData.averageOutstanding !== undefined) {
        doc.text(`Average Outstanding: Rs ${reportData.averageOutstanding.toFixed(2)}`, 14, 59)
    }

    // Customers table
    if (reportData.customers && reportData.customers.length > 0) {
        autoTable(doc, {
            startY: 70,
            head: [['Customer Name', 'Phone', 'Balance']],
            body: reportData.customers.map((customer: any) => [
                customer.name,
                customer.phone,
                `Rs ${customer.balance?.toFixed(2) || '0.00'}`
            ])
        })
    }

    doc.save(`outstanding_balances_${Date.now()}.pdf`)
}
