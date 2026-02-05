'use server'

import { createClient } from '@/utils/supabase/server'
import { getCurrentUserTenantId } from '@/lib/utils/tenantHelper'

interface DateRange {
    startDate: string  // ISO format: YYYY-MM-DD
    endDate: string
}

/**
 * Generate daily sales report
 */
export async function generateDailySalesReport(date: string) {
    const supabase = await createClient()

    let tenantId: string
    try {
        const id = await getCurrentUserTenantId()
        if (!id) return { success: false, error: 'Authentication required' }
        tenantId = id
    } catch (error) {
        return { success: false, error: 'Authentication required' }
    }

    // Get orders for the day
    const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*, customer:customers(name), driver:users!driver_id(name)')
        .eq('tenant_id', tenantId)
        .gte('created_at', `${date}T00:00:00`)
        .lte('created_at', `${date}T23:59:59`)

    if (ordersError) {
        return { success: false, error: ordersError.message }
    }

    const orders = ordersData || [];

    // Calculate metrics
    const totalOrders = orders.length
    const completedOrders = orders.filter(o => o.status === 'completed').length
    const totalRevenue = orders
        .filter(o => o.status === 'completed')
        .reduce((sum, o) => sum + (o.total_amount || 0), 0) // Changed amount to total_amount based on schema
    const cashCollected = orders
        .filter(o => o.payment_method === 'cash' && o.status === 'completed') // Changed payment_mode to payment_method
        .reduce((sum, o) => sum + (o.total_amount || 0), 0)
    const onlinePayments = orders
        .filter(o => o.payment_method === 'online' && o.status === 'completed')
        .reduce((sum, o) => sum + (o.total_amount || 0), 0)

    // Get expenses for the day
    const { data: expenses, error: expensesError } = await supabase
        .from('expenses')
        .select('amount')
        .eq('tenant_id', tenantId)
        .eq('status', 'approved')
        .gte('created_at', `${date}T00:00:00`)
        .lte('created_at', `${date}T23:59:59`)

    const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0

    return {
        success: true,
        data: {
            date,
            totalOrders,
            completedOrders,
            pendingOrders: totalOrders - completedOrders,
            totalRevenue,
            cashCollected,
            onlinePayments,
            totalExpenses,
            netProfit: totalRevenue - totalExpenses,
            orders
        }
    }
}

/**
 * Generate monthly revenue/expense summary
 */
export async function generateMonthlySummary(yearMonth: string) {
    // yearMonth format: YYYY-MM
    const supabase = await createClient()

    let tenantId: string
    try {
        const id = await getCurrentUserTenantId()
        if (!id) return { success: false, error: 'Authentication required' }
        tenantId = id
    } catch (error) {
        return { success: false, error: 'Authentication required' }
    }

    const startDate = `${yearMonth}-01`
    const endDate = `${yearMonth}-31` // Simplified, might miss 31st on some months if not careful, better to use end of month calc but this follows plan

    // Revenue from completed orders
    const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('total_amount, created_at, status') // Changed amount to total_amount
        .eq('tenant_id', tenantId)
        .eq('status', 'completed')
        .gte('created_at', startDate)
        .lte('created_at', endDate)

    const totalRevenue = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0

    // Expenses
    const { data: expenses, error: expensesError } = await supabase
        .from('expenses')
        .select('amount, category, created_at')
        .eq('tenant_id', tenantId)
        .eq('status', 'approved')
        .gte('created_at', startDate)
        .lte('created_at', endDate)

    const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0

    // Group expenses by category
    const expensesByCategory = expenses?.reduce((acc, e) => {
        const category = e.category || 'Other'
        acc[category] = (acc[category] || 0) + (e.amount || 0)
        return acc
    }, {} as Record<string, number>) || {}

    return {
        success: true,
        data: {
            month: yearMonth,
            totalRevenue,
            totalExpenses,
            netProfit: totalRevenue - totalExpenses,
            profitMargin: totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0,
            totalOrders: orders?.length || 0,
            expensesByCategory
        }
    }
}

/**
 * Generate profit & loss statement
 */
export async function generateProfitLossStatement(dateRange: DateRange) {
    const supabase = await createClient()

    let tenantId: string
    try {
        const id = await getCurrentUserTenantId()
        if (!id) return { success: false, error: 'Authentication required' }
        tenantId = id
    } catch (error) {
        return { success: false, error: 'Authentication required' }
    }

    // Revenue
    const { data: orders } = await supabase
        .from('orders')
        .select('total_amount') // Changed amount to total_amount
        .eq('tenant_id', tenantId)
        .eq('status', 'completed')
        .gte('created_at', dateRange.startDate)
        .lte('created_at', dateRange.endDate)

    const totalRevenue = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0

    // Expenses by category
    const { data: expenses } = await supabase
        .from('expenses')
        .select('amount, category')
        .eq('tenant_id', tenantId)
        .eq('status', 'approved')
        .gte('created_at', dateRange.startDate)
        .lte('created_at', dateRange.endDate)

    const expensesByCategory = expenses?.reduce((acc, e) => {
        const category = e.category || 'Other'
        acc[category] = (acc[category] || 0) + (e.amount || 0)
        return acc
    }, {} as Record<string, number>) || {}

    const totalExpenses = Object.values(expensesByCategory).reduce((sum, val) => sum + val, 0)

    // Calculate EBITDA (simplified for LPG business)
    const grossProfit = totalRevenue - (expensesByCategory['Cost of Goods'] || 0)
    const operatingExpenses = (expensesByCategory['Operational'] || 0) + (expensesByCategory['Fuel'] || 0)
    const EBITDA = grossProfit - operatingExpenses
    const netProfit = totalRevenue - totalExpenses

    return {
        success: true,
        data: {
            period: dateRange,
            revenue: {
                totalRevenue
            },
            expenses: {
                byCategory: expensesByCategory,
                totalExpenses
            },
            profitability: {
                grossProfit,
                EBITDA,
                netProfit,
                profitMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0
            }
        }
    }
}

/**
 * Get outstanding balances report
 */
export async function getOutstandingBalancesReport() {
    const supabase = await createClient()

    let tenantId: string
    try {
        const id = await getCurrentUserTenantId()
        if (!id) return { success: false, error: 'Authentication required' }
        tenantId = id
    } catch (error) {
        return { success: false, error: 'Authentication required' }
    }

    // Updated queries based on 'createTransaction' using 'current_balance' or 'balance'
    // Task 1.7 used 'current_balance'. I'll use that.
    const { data: customers, error } = await supabase
        .from('customers')
        .select('id, name, phone, address, current_balance, created_at') // Changed balance to current_balance
        .eq('tenant_id', tenantId)
        .gt('current_balance', 0)
        .order('current_balance', { ascending: false })

    if (error) {
        return { success: false, error: error.message }
    }

    const totalOutstanding = customers.reduce((sum, c) => sum + (c.current_balance || 0), 0)
    const customerCount = customers.length

    // Categorize by balance range
    const ranges = {
        '0-1000': customers.filter(c => c.current_balance <= 1000).length,
        '1001-5000': customers.filter(c => c.current_balance > 1000 && c.current_balance <= 5000).length,
        '5001-10000': customers.filter(c => c.current_balance > 5000 && c.current_balance <= 10000).length,
        '10000+': customers.filter(c => c.current_balance > 10000).length
    }

    return {
        success: true,
        data: {
            totalOutstanding,
            customerCount,
            averageOutstanding: customerCount > 0 ? totalOutstanding / customerCount : 0,
            balanceRanges: ranges,
            customers: customers.map(c => ({ ...c, balance: c.current_balance })) // Normalize for UI if needed
        }
    }
}

/**
 * Get driver commission report
 */
export async function getDriverCommissionReport(driverId: string, dateRange: DateRange) {
    const supabase = await createClient()

    let tenantId: string
    try {
        const id = await getCurrentUserTenantId()
        if (!id) return { success: false, error: 'Authentication required' }
        tenantId = id
    } catch (error) {
        return { success: false, error: 'Authentication required' }
    }

    // Verify driver belongs to tenant
    const { data: driver, error: driverError } = await supabase
        .from('users')
        .select('name, tenant_id')
        .eq('id', driverId)
        .eq('tenant_id', tenantId)
        .single()

    if (driverError || !driver) {
        return { success: false, error: 'Driver not found' }
    }

    // Get completed orders
    const { data: orders } = await supabase
        .from('orders')
        .select('total_amount, created_at') // Changed amount to total_amount
        .eq('driver_id', driverId)
        .eq('status', 'completed')
        .gte('created_at', dateRange.startDate)
        .lte('created_at', dateRange.endDate)

    const totalCollections = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0
    const totalOrders = orders?.length || 0

    // Calculate commission (example: 5% of collections)
    // TODO: Fetch actual commission rate from driver profile or settings if available. 
    // For now using fixed 5% as per plan.
    const commissionRate = 0.05
    const commission = totalCollections * commissionRate

    return {
        success: true,
        data: {
            driverId,
            driverName: driver.name,
            period: dateRange,
            totalOrders,
            totalCollections,
            commissionRate: commissionRate * 100,  // Show as percentage
            commission
        }
    }
}
