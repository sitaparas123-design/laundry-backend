const express = require('express');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Payment = require('../models/Payment');
const Pickup = require('../models/Pickup');
const Delivery = require('../models/Delivery');
const User = require('../models/User');
const Driver = require('../models/Driver');
const Role = require('../models/Role');
const Branch = require('../models/Branch');
const Expense = require('../models/Expense');
const LaundryService = require('../models/LaundryService');
const { authenticate, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Helper to apply branch filter based on user role and query parameter
const applyBranchFilter = (req, baseFilter = {}, isUser = false) => {
  const queryBranchId = req.query.branchId || req.headers['x-branch-id'];
  const field = isUser ? 'branch' : 'branchId';

  if (queryBranchId && queryBranchId !== 'all' && queryBranchId !== 'undefined' && queryBranchId !== 'null') {
    try {
      return { ...baseFilter, [field]: new mongoose.Types.ObjectId(queryBranchId) };
    } catch (e) {
      console.error('Invalid branchId query parameter:', queryBranchId);
    }
  }

  if (req.user.role !== 'Super Admin' && req.user.branch) {
    return { ...baseFilter, [field]: new mongoose.Types.ObjectId(req.user.branch) };
  }

  return baseFilter;
};

// Helper for date range filter
const applyDateFilter = (start, end, dateField = 'date', baseFilter = {}) => {
  const filter = { ...baseFilter };
  if (start || end) {
    filter[dateField] = {};
    if (start) filter[dateField].$gte = start;
    if (end) filter[dateField].$lte = end;
  }
  return filter;
};

// Helper to normalize and map service names to official Laundry Services
const normalizeServiceName = (serviceType, dbServices = []) => {
  const s = String(serviceType || '').toLowerCase().trim();
  if (s.includes('express') && (s.includes('iron') || s.includes('press')) && (s.includes('wash') || s.includes('fold'))) {
    return 'Express Wash & Iron';
  }
  if (s.includes('express') && (s.includes('wash') || s.includes('fold'))) {
    return 'Express Wash & Iron';
  }
  if (s.includes('express') && (s.includes('iron') || s.includes('press'))) {
    return 'Express Ironing';
  }
  if (s.includes('wash') || s.includes('fold') || s.includes('normal wash')) {
    return 'Wash & Iron';
  }
  if (s.includes('iron') || s.includes('press')) {
    return 'Normal Ironing';
  }
  if (dbServices && dbServices.length > 0) {
    const matched = dbServices.find(dbS => (dbS.name || '').toLowerCase() === s);
    if (matched) return matched.name;
  }
  return serviceType || 'Wash & Iron';
};

// @route   GET /api/reports/dashboard
// @desc    Get metrics for dashboard charts and summaries
router.get('/dashboard', authenticate, requirePermission('view_reports'), async (req, res) => {
  try {
    const { start, end } = req.query;
    
    // Build filters
    const orderFilter = applyBranchFilter(req, applyDateFilter(start, end, 'date'));
    const paymentFilter = applyBranchFilter(req, applyDateFilter(start, end, 'date'));
    const pickupFilter = applyBranchFilter(req, applyDateFilter(start, end, 'pickupDate'));
    const deliveryFilter = applyBranchFilter(req, applyDateFilter(start, end, 'deliveryDate'));
    
    const orders = await Order.find(orderFilter);
    const payments = await Payment.find(paymentFilter);
    const customers = await Customer.find(applyBranchFilter(req, {}, true));
    const pickups = await Pickup.find(pickupFilter);
    const deliveries = await Delivery.find(deliveryFilter);
    const users = await User.find(applyBranchFilter(req, {}, true)).populate('role');
    const dbServices = await LaundryService.find();
    
    const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || o.amount || 0), 0);
    const totalOrders = orders.length;
    const completedOrders = orders.filter(o => o.status === 'Delivered').length;
    
    const terminalStatuses = ['Delivered', 'Return', 'Cancelled', 'Store', 'In Store'];
    const pendingOrders = orders.filter(o => !terminalStatuses.includes(o.status)).length;
    
    const activeCustomers = customers.filter(c => c.status === 'Active').length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    // Dynamic Service Revenue & Counts from DB Services
    const serviceRevenue = {};
    const defaultServices = dbServices.length > 0
      ? dbServices.map(s => s.name)
      : ['Normal Ironing', 'Wash & Iron', 'Express Ironing', 'Express Wash & Iron'];
      
    defaultServices.forEach(name => {
      serviceRevenue[name] = 0;
    });

    orders.forEach(o => {
      const sName = normalizeServiceName(o.serviceType || o.service, dbServices);
      const val = o.totalAmount || o.amount || 0;
      serviceRevenue[sName] = (serviceRevenue[sName] || 0) + val;
    });

    // Helper to normalize payment methods
    const normalizePaymentMethod = (method) => {
      const m = String(method || '').toLowerCase().trim();
      if (m === 'k-net' || m === 'knet' || m === 'card' || m === 'بطاقة' || m === 'شبكة') return 'K-Net';
      if (m === 'bukey' || m === 'bouquet' || m === 'باقة' || m === 'باقات' || m === 'package' || m === 'subscription') return 'Bukey';
      if (m === 'credit' || m === 'آجل' || m === 'ذمم' || m === 'unpaid' || m === 'غير مدفوع' || m === 'pending') return 'Credit';
      if (m === 'link' || m === 'رابط') return 'Link';
      return 'Cash';
    };

    // Real Payment Distribution from orders & payments in period
    const paymentDistribution = {
      Cash: 0,
      'K-Net': 0,
      Bukey: 0,
      Credit: 0
    };

    orders.forEach(o => {
      const isPaid = o.paymentStatus === 'Paid';
      const m = o.paymentMethod || (isPaid ? 'Cash' : 'Credit');
      const normMethod = normalizePaymentMethod(m);
      const amount = Number(o.totalAmount || o.amount || 0);
      if (paymentDistribution[normMethod] !== undefined) {
        paymentDistribution[normMethod] += amount;
      } else {
        paymentDistribution[normMethod] = amount;
      }
    });

    payments.forEach(p => {
      const isAlreadyInOrders = p.order && orders.some(o => o._id.toString() === p.order.toString());
      if (!isAlreadyInOrders) {
        const normMethod = normalizePaymentMethod(p.method);
        const amount = Number(p.amount || 0);
        if (paymentDistribution[normMethod] !== undefined) {
          paymentDistribution[normMethod] += amount;
        } else {
          paymentDistribution[normMethod] = amount;
        }
      }
    });

    // Payment method breakdown object
    const paymentMethodBreakdown = { ...paymentDistribution };

    // Order status breakdown object with official system statuses
    const orderStatusBreakdown = {
      Waiting: 0,
      'Preparing in shop': 0,
      'Preparing in workshop': 0,
      Hold: 0,
      Ready: 0,
      'Ready for delivery': 0,
      'Ready for shop': 0,
      'With Driver': 0,
      Delivered: 0,
      Return: 0,
      Store: 0
    };

    const normalizeOrderStatus = (status) => {
      const s = String(status || '').trim();
      const legacyMap = {
        Received: 'Waiting',
        'In Workshop': 'Preparing in workshop',
        'In Shop': 'Preparing in shop',
        'On Hold': 'Hold',
        'In Store': 'Store',
        'H Services': 'Ready for delivery',
        Cancel: 'Return',
        Cancelled: 'Return',
        Washing: 'Preparing in shop',
        Drying: 'Preparing in workshop',
        Ironing: 'Preparing in workshop',
      };
      return legacyMap[s] || s;
    };

    orders.forEach(o => {
      if (o.status) {
        const norm = normalizeOrderStatus(o.status);
        if (orderStatusBreakdown[norm] !== undefined) {
          orderStatusBreakdown[norm] += 1;
        } else {
          orderStatusBreakdown[norm] = 1;
        }
      }
    });

    // Previous Period calculations for growth
    let prevStart, prevEnd;
    if (start && end) {
      const s = new Date(start);
      const e = new Date(end);
      const diffTime = Math.abs(e - s);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 30;
      
      const ps = new Date(s);
      ps.setDate(ps.getDate() - diffDays - 1);
      const pe = new Date(s);
      pe.setDate(pe.getDate() - 1);
      
      prevStart = ps.toISOString().split('T')[0];
      prevEnd = pe.toISOString().split('T')[0];
    } else {
      const s = new Date();
      s.setDate(s.getDate() - 30);
      const e = new Date();
      
      const ps = new Date();
      ps.setDate(ps.getDate() - 60);
      const pe = new Date();
      pe.setDate(pe.getDate() - 31);
      
      prevStart = ps.toISOString().split('T')[0];
      prevEnd = pe.toISOString().split('T')[0];
    }

    const prevOrderFilter = applyBranchFilter(req, applyDateFilter(prevStart, prevEnd, 'date'));
    const prevOrders = await Order.find(prevOrderFilter);
    const prevRevenue = prevOrders.reduce((sum, o) => sum + (o.totalAmount || o.amount || 0), 0);
    const prevOrdersCount = prevOrders.length;
    const prevCompletedOrders = prevOrders.filter(o => o.status === 'Delivered').length;
    const prevPendingOrders = prevOrders.filter(o => !terminalStatuses.includes(o.status)).length;
    const prevAverageOrderValue = prevOrdersCount > 0 ? prevRevenue / prevOrdersCount : 0;

    const currentRegisteredCustomers = customers.filter(c => {
      const regDate = c.registrationDate || c.createdAt;
      if (!regDate) return false;
      const dStr = typeof regDate === 'string' ? regDate : new Date(regDate).toISOString().split('T')[0];
      return dStr >= (start || '') && dStr <= (end || '');
    }).length;
    
    const prevRegisteredCustomers = customers.filter(c => {
      const regDate = c.registrationDate || c.createdAt;
      if (!regDate) return false;
      const dStr = typeof regDate === 'string' ? regDate : new Date(regDate).toISOString().split('T')[0];
      return dStr >= prevStart && dStr <= prevEnd;
    }).length;

    const getGrowthMetrics = (current, previous) => {
      if (previous === 0) {
        return { text: current > 0 ? '+100%' : '0%', positive: current >= 0 };
      }
      const val = ((current - previous) / previous) * 100;
      return { text: `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`, positive: val >= 0 };
    };

    const growth = {
      revenue: getGrowthMetrics(totalRevenue, prevRevenue),
      orders: getGrowthMetrics(totalOrders, prevOrdersCount),
      completed: getGrowthMetrics(completedOrders, prevCompletedOrders),
      pending: getGrowthMetrics(pendingOrders, prevPendingOrders),
      customers: getGrowthMetrics(currentRegisteredCustomers, prevRegisteredCustomers),
      avgOrder: getGrowthMetrics(averageOrderValue, prevAverageOrderValue)
    };

    // Payment Analytics
    const paidAmount = orders.filter(o => o.paymentStatus === 'Paid').reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const pendingAmount = orders.filter(o => o.paymentStatus === 'Pending' || o.paymentStatus === 'Overdue').reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const partialAmount = orders.filter(o => o.paymentStatus === 'Partial').reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const dueCustomers = customers.filter(c => (c.balance || 0) > 0).length;

    const paymentsAnalytics = {
      paidAmount,
      pendingAmount,
      partialAmount,
      dueCustomers
    };

    // Home Service Analytics
    const totalPickups = pickups.length;
    const completedPickups = pickups.filter(p => p.status === 'Completed').length;
    const totalDeliveries = deliveries.length;
    const failedDeliveries = deliveries.filter(d => d.status === 'Failed').length;

    const logisticsAnalytics = {
      totalPickups,
      completedPickups,
      totalDeliveries,
      failedDeliveries
    };

    // Top Customers
    const customerMap = {};
    orders.forEach(o => {
      const name = o.customerName || 'Unknown';
      if (!customerMap[name]) {
        customerMap[name] = {
          customerName: name,
          totalOrders: 0,
          totalRevenue: 0,
          lastOrderDate: o.date
        };
      }
      customerMap[name].totalOrders += 1;
      customerMap[name].totalRevenue += (o.totalAmount || 0);
      if (new Date(o.date) > new Date(customerMap[name].lastOrderDate)) {
        customerMap[name].lastOrderDate = o.date;
      }
    });
    const topCustomers = Object.values(customerMap)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10);

    // Staff Performance
    const staffPerformance = users.map(u => {
      const userOrders = orders.filter(o => o.createdBy === u.name || o.createdBy === u.username);
      const userDeliveries = deliveries.filter(d => (d.assignedStaff === u.name || d.assignedStaff === u.username) && d.status === 'Delivered');
      
      const ordersHandledCount = userOrders.length;
      const deliveriesCompletedCount = userDeliveries.length;
      const revenueGeneratedSum = userOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      
      return {
        staffName: u.name,
        role: u.role ? u.role.name : 'Staff',
        ordersHandled: ordersHandledCount,
        deliveriesCompleted: deliveriesCompletedCount,
        revenueGenerated: revenueGeneratedSum
      };
    });

    const todayStr = new Date().toISOString().split('T')[0];
    const todayOrders = orders.filter(o => o.date === todayStr);
    const todayPayments = payments.filter(p => p.date === todayStr);

    const daily = {
      revenueToday: todayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
      ordersToday: todayOrders.length,
      paymentsReceived: todayPayments.reduce((sum, p) => sum + (p.amount || 0), 0)
    };

    const monthly = {
      monthlyRevenue: totalRevenue,
      revenueGrowth: growth.revenue,
      revenueComparison: prevRevenue
    };

    const ordersStats = {
      totalOrders: orders.length,
      pendingOrders: pendingOrders,
      deliveredOrders: completedOrders,
      cancelledOrders: orders.filter(o => o.status === 'Cancelled').length
    };

    res.json({
      summary: {
        totalRevenue,
        totalOrders,
        completedOrders,
        pendingOrders,
        activeCustomers,
        averageOrderValue,
        growth
      },
      periodOrders: orders,
      serviceRevenue,
      paymentDistribution,
      periodPayments: payments,
      paymentMethodBreakdown,
      orderStatusBreakdown,
      payments: paymentsAnalytics,
      logistics: logisticsAnalytics,
      topCustomers,
      staffPerformance,
      daily,
      monthly,
      orders: ordersStats
    });
  } catch (error) {
    console.error('Reports Dashboard Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   GET /api/reports/generate
// @desc    Generate specific tabular reports
router.get('/generate', authenticate, requirePermission('view_reports'), async (req, res) => {
  try {
    const { reportType, category, parameter, start, end } = req.query;
    const orderFilter = applyBranchFilter(req, applyDateFilter(start, end, 'date'));
    
    let data = [];
    
    if (reportType === 'branch_sales') {
       const orders = await Order.find(applyDateFilter(start, end, 'date')).populate('branchId');
       const groups = {};
       orders.forEach(o => {
         const bName = o.branchId ? o.branchId.name : 'Unknown';
         if (req.user.role !== 'Super Admin' && req.user.branch !== (o.branchId && o.branchId._id.toString())) {
            return;
         }
         if (parameter && parameter !== 'All' && bName !== parameter) return;
         if (!groups[bName]) groups[bName] = { branch: bName, count: 0, revenue: 0 };
         groups[bName].count += 1;
         groups[bName].revenue += (o.totalAmount || 0);
       });
       data = Object.values(groups).map(g => ({
         ...g,
         avgValue: g.count > 0 ? g.revenue / g.count : 0
       }));
    }
    else if (reportType === 'total_sales') {
       const orders = await Order.find(orderFilter);
       const groups = {};
       orders.forEach(o => {
         if (!groups[o.date]) {
           groups[o.date] = { date: o.date, count: 0, subtotal: 0, discount: 0, tax: 0, total: 0 };
         }
         groups[o.date].count += 1;
         groups[o.date].subtotal += (Number(o.amount) || 0);
         groups[o.date].discount += (Number(o.discountAmount) || 0);
         groups[o.date].tax += (Number(o.tax) || 0);
         groups[o.date].total += (Number(o.totalAmount) || 0);
       });
       data = Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
    }
    else if (reportType === 'sales_detail') {
       const orders = await Order.find(orderFilter);
       orders.forEach(o => {
         const serviceLower = (o.serviceType || 'Normal').toLowerCase();
         const isExpress = serviceLower.includes('express');
         if (parameter === 'Express' && !isExpress) return;
         if (parameter === 'Normal' && isExpress) return;

         if (o.itemDetails) {
           o.itemDetails.forEach(it => {
             if (parameter && parameter !== 'All' && parameter !== 'Express' && parameter !== 'Normal' && it.name !== parameter) return;
             data.push({
               id: `${o.id}-${it.name}`,
               orderNo: o.number,
               customerName: o.customerName,
               date: o.date,
               itemName: it.name,
               service: o.serviceType || 'Normal',
               qty: it.quantity,
               price: it.unitPrice,
               total: it.quantity * it.unitPrice
             });
           });
         }
       });
    }
    else if (reportType === 'payment_methods') {
       const payments = await Payment.find(applyBranchFilter(req, applyDateFilter(start, end, 'date')));
       const groups = {};
       payments.forEach(p => {
         if (!groups[p.method]) groups[p.method] = { method: p.method, count: 0, collected: 0 };
         groups[p.method].count += 1;
         groups[p.method].collected += (Number(p.amount) || 0);
       });
       data = Object.values(groups);
    }
    else if (reportType === 'customer_list') {
       let customers = await Customer.find(applyBranchFilter(req, {}, true));
       if (parameter && parameter !== 'All') {
         customers = customers.filter(c => c._id.toString() === parameter);
       }
       data = customers.map(c => ({
         id: c._id,
         customerId: `CUS-${c._id.toString().substring(c._id.toString().length - 4).toUpperCase()}`,
         name: c.name,
         phone: c.phone,
         registered: c.registrationDate || c.createdAt,
         discount: c.customerLevel || '0%',
         ordersCount: c.totalOrders || 0,
         balance: c.balance || 0
       }));
    }
    else if (reportType === 'top_customers') {
       const orders = await Order.find(orderFilter);
       const map = {};
       orders.forEach(o => {
          const key = o.customerName || 'Unknown';
          if (!map[key]) map[key] = { name: key, ordersCount: 0, spent: 0, lastDate: o.date };
          map[key].ordersCount += 1;
          map[key].spent += (o.totalAmount || 0);
          if (new Date(o.date) > new Date(map[key].lastDate)) map[key].lastDate = o.date;
       });
       let arr = Object.values(map).sort((a, b) => b.spent - a.spent);
       if (parameter && parameter !== 'All') {
          const cust = await Customer.findById(parameter);
          if (cust) arr = arr.filter(c => c.name === cust.name);
       }
       data = arr.map((c, i) => ({ id: i+1, ...c }));
    }
    else if (reportType === 'customer_debts') {
       let customers = await Customer.find(applyBranchFilter(req, { balance: { $gt: 0 } }, true)).sort({ balance: -1 });
       if (parameter && parameter !== 'All') {
         customers = customers.filter(c => c._id.toString() === parameter);
       }
       data = customers.map(c => ({
         id: c._id,
         name: c.name,
         phone: c.phone,
         registered: c.registrationDate || c.createdAt,
         balance: c.balance
       }));
    }
    else if (reportType === 'completed_jobs' || reportType === 'pending_jobs') {
       const isCompleted = reportType === 'completed_jobs';
       let pFilter = applyDateFilter(start, end, 'pickupDate');
       let dFilter = applyDateFilter(start, end, 'deliveryDate');
       if (isCompleted) {
         pFilter.status = 'Completed';
         dFilter.status = 'Delivered';
       } else {
         pFilter.status = { $ne: 'Completed' };
         dFilter.status = { $ne: 'Delivered' };
       }
        const pickups = await Pickup.find(applyBranchFilter(req, pFilter));
        const deliveries = await Delivery.find(applyBranchFilter(req, dFilter));
       const items = [];
       pickups.forEach(p => items.push({ 
         id: `PKP-${p._id}`, reqId: p.pickupId || `PKP-${p._id}`, type: 'Pickup', 
         customer: p.customer, date: p.pickupDate, driver: p.assignedStaff || 'Unassigned', status: p.status 
       }));
       deliveries.forEach(d => items.push({ 
         id: `DEL-${d._id}`, reqId: d.deliveryId || `DEL-${d._id}`, type: 'Delivery', 
         customer: d.customer, date: d.deliveryDate, driver: d.assignedStaff || 'Unassigned', status: d.status 
       }));
       data = items.sort((a, b) => b.date.localeCompare(a.date));
    }
    else if (reportType === 'user_sales') {
       const orders = await Order.find(orderFilter);
       const expenses = await Expense.find(applyBranchFilter(req, applyDateFilter(start, end, 'date')));
       const customers = await Customer.find(applyBranchFilter(req, applyDateFilter(start, end, 'createdAt')));

       const groups = {};
       const getGroup = (name) => {
         const u = name || 'Counter Staff';
         if (!groups[u]) {
           groups[u] = {
             name: u,
             count: 0,
             sales: 0,
             cashCollected: 0,
             knetCollected: 0,
             bukeyCollected: 0,
             creditPending: 0,
             cashExpenses: 0,
             netCashInHand: 0,
             newCustomers: 0,
             subscribersAcquired: 0
           };
         }
         return groups[u];
       };

       orders.forEach(o => {
         const u = o.createdBy || 'Staff';
         if (parameter && parameter !== 'All' && u !== parameter) return;
         const grp = getGroup(u);
         grp.count += 1;
         grp.sales += (Number(o.totalAmount) || 0);

         const m = (o.paymentMethod || '').toLowerCase();
         const isPaid = o.paymentStatus === 'Paid';
         const isPartial = o.paymentStatus === 'Partial';
         const paid = o.amountPaid !== undefined && o.amountPaid !== null && Number(o.amountPaid) > 0
           ? Number(o.amountPaid)
           : (isPaid ? Number(o.totalAmount || 0) : 0);
         const tot = Number(o.totalAmount || 0);

         if (paid > 0) {
           if (/k-net|knet|card|بطاقة|شبكة|link/.test(m)) grp.knetCollected += paid;
           else if (/bukey|bouquet|باقة|package|subscription/.test(m)) grp.bukeyCollected += paid;
           else if (/unpaid|pending|credit|آجل/.test(m) && !isPaid) { /* credit */ }
           else grp.cashCollected += paid;
         }

         if (o.paymentStatus === 'Pending' || /credit|آجل|unpaid|pending|غير مدفوع/.test(m)) {
           grp.creditPending += (tot > paid ? tot - paid : tot);
         } else if (isPartial && tot > paid) {
           grp.creditPending += (tot - paid);
         }
       });

       expenses.forEach(e => {
         const u = e.createdBy || 'Staff';
         if (groups[u] && /cash|نقدي/i.test(e.paymentMethod || '')) {
           groups[u].cashExpenses += (Number(e.amount) || 0);
         }
       });

       customers.forEach(c => {
         const u = c.createdBy || 'Counter Staff';
         if (groups[u]) {
           groups[u].newCustomers += 1;
           if (c.isSubscriber || Number(c.insuranceAmount || 0) >= 20) {
             groups[u].subscribersAcquired += 1;
           }
         }
       });

       Object.values(groups).forEach(g => {
         g.netCashInHand = Math.max(0, g.cashCollected - g.cashExpenses);
       });

       data = Object.values(groups);
    }
    else if (reportType === 'area_sales') {
       const customers = await Customer.find(applyBranchFilter(req, {}, true));
       const orders = await Order.find(orderFilter);
       const areaMap = {};

       customers.forEach(c => {
         const area = (c.areaName || 'General / غير محدد').trim();
         if (parameter && parameter !== 'All' && area !== parameter) return;
         if (!areaMap[area]) {
           areaMap[area] = { area, customerCount: 0, subscriberCount: 0, orderCount: 0, totalSales: 0 };
         }
         areaMap[area].customerCount += 1;
         if (c.isSubscriber || Number(c.insuranceAmount || 0) >= 20) {
           areaMap[area].subscriberCount += 1;
         }
       });

       orders.forEach(o => {
         const cust = customers.find(c => String(c._id) === String(o.customer) || c.name === o.customerName);
         const area = (cust?.areaName || 'General / غير محدد').trim();
         if (parameter && parameter !== 'All' && area !== parameter) return;
         if (!areaMap[area]) {
           areaMap[area] = { area, customerCount: 0, subscriberCount: 0, orderCount: 0, totalSales: 0 };
         }
         areaMap[area].orderCount += 1;
         areaMap[area].totalSales += (Number(o.totalAmount) || 0);
       });

       data = Object.values(areaMap).sort((a, b) => b.totalSales - a.totalSales);
    }
    else if (reportType === 'shift_settlement') {
        const orders = await Order.find(orderFilter);
        const payments = await Payment.find(applyBranchFilter(req, applyDateFilter(start, end, 'date')));
        const expenses = await Expense.find(applyBranchFilter(req, applyDateFilter(start, end, 'date')));

        // Helper to determine shift from timestamp: Morning (< 3 PM / 15:00), Evening (>= 3 PM / 15:00)
        const getItemShift = (item) => {
          if (item.shift === 'Morning' || item.shift === 'Evening') return item.shift;
          const created = new Date(item.createdAt || item.date);
          const hour = created.getHours();
          return hour < 15 ? 'Morning' : 'Evening';
        };

        // Filter items if user selected Morning or Evening specifically
        const filterByShiftParam = (item) => {
          if (!parameter || parameter === 'All' || parameter === 'All Day') return true;
          return getItemShift(item) === parameter;
        };

        const filteredOrders = orders.filter(filterByShiftParam);
        const filteredPayments = payments.filter(filterByShiftParam);
        const filteredExpenses = expenses.filter(filterByShiftParam);

        // Group orders by shift and staff
        // Key: `${shift}_${staffName}`
        const groups = {};

        filteredOrders.forEach((o) => {
          const shift = getItemShift(o);
          const staffName = o.createdBy || o.staffName || 'Counter Staff';
          const groupKey = `${shift}___${staffName}`;

          if (!groups[groupKey]) {
            groups[groupKey] = {
              shiftKey: shift,
              shift: shift === 'Morning' ? 'Morning' : 'Evening',
              staffName: staffName,
              invoicesCount: 0,
              totalRevenue: 0,
              cashCollected: 0,
              knetCollected: 0,
              bukeyCollected: 0,
              creditCollected: 0,
              cashExpenses: 0,
              netCashInHand: 0,
            };
          }

          groups[groupKey].invoicesCount += 1;
          const tot = Number(o.totalAmount || 0);
          groups[groupKey].totalRevenue += tot;

          const m = (o.paymentMethod || '').toLowerCase();
          const isPaid = o.paymentStatus === 'Paid';
          const isPartial = o.paymentStatus === 'Partial';
          const paid = o.amountPaid !== undefined && o.amountPaid !== null && Number(o.amountPaid) > 0
            ? Number(o.amountPaid)
            : (isPaid ? tot : 0);

          if (paid > 0) {
            if (/k-net|knet|card|بطاقة|شبكة|link/.test(m)) {
              groups[groupKey].knetCollected += paid;
            } else if (/bukey|bouquet|باقة|package|subscription/.test(m)) {
              groups[groupKey].bukeyCollected += paid;
            } else if (/unpaid|pending|credit|آجل/.test(m) && !isPaid) {
              // credit
            } else {
              groups[groupKey].cashCollected += paid;
            }
          }

          if (o.paymentStatus === 'Pending' || /credit|آجل|unpaid|pending|غير مدفوع/.test(m)) {
            groups[groupKey].creditCollected += (tot > paid ? tot - paid : tot);
          } else if (isPartial && tot > paid) {
            groups[groupKey].creditCollected += (tot - paid);
          }
        });

        // Account for cash expenses per staff/shift
        filteredExpenses.forEach((e) => {
          const shift = getItemShift(e);
          const staffName = e.createdBy || 'Staff';
          const groupKey = `${shift}___${staffName}`;
          if (groups[groupKey] && /cash|نقدي/i.test(e.paymentMethod || '')) {
            groups[groupKey].cashExpenses += (Number(e.amount) || 0);
          }
        });

        // Compute netCashInHand for each group
        Object.values(groups).forEach((g) => {
          g.netCashInHand = Math.max(0, g.cashCollected - g.cashExpenses);
        });

        // Sort groups: Morning shifts first, then Evening shifts
        const staffRows = Object.values(groups).sort((a, b) => {
          if (a.shiftKey === b.shiftKey) return a.staffName.localeCompare(b.staffName);
          return a.shiftKey === 'Morning' ? -1 : 1;
        });

        // Calculate Grand Totals across all filtered items
        const totalInvoices = staffRows.reduce((sum, r) => sum + r.invoicesCount, 0);
        const totalRevenue = staffRows.reduce((sum, r) => sum + r.totalRevenue, 0);
        const totalCash = staffRows.reduce((sum, r) => sum + r.cashCollected, 0);
        const totalKnet = staffRows.reduce((sum, r) => sum + r.knetCollected, 0);
        const totalBukey = staffRows.reduce((sum, r) => sum + r.bukeyCollected, 0);
        const totalCredit = staffRows.reduce((sum, r) => sum + r.creditCollected, 0);
        const totalCashExpenses = staffRows.reduce((sum, r) => sum + r.cashExpenses, 0);
        const totalNetCash = Math.max(0, totalCash - totalCashExpenses);

        const morningStaffNames = [...new Set(staffRows.filter((r) => r.shiftKey === 'Morning').map((r) => r.staffName))];
        const eveningStaffNames = [...new Set(staffRows.filter((r) => r.shiftKey === 'Evening').map((r) => r.staffName))];

        const summaryRow = {
          shift: 'TOTAL',
          staffName: 'All Counter Staff',
          invoicesCount: totalInvoices,
          totalRevenue: totalRevenue,
          cashCollected: totalCash,
          knetCollected: totalKnet,
          bukeyCollected: totalBukey,
          creditCollected: totalCredit,
          cashExpenses: totalCashExpenses,
          netCashInHand: totalNetCash,
          isTotalRow: true,
          morningStaff: morningStaffNames,
          eveningStaff: eveningStaffNames,
          staffBreakdown: staffRows,
          expensesBreakdown: filteredExpenses.map((e) => ({
            id: e._id,
            title: e.title,
            amount: e.amount,
            category: e.category,
            paymentMethod: e.paymentMethod,
            time: e.time,
            createdBy: e.createdBy,
          })),
        };

        // Combine staff rows + summary total row
        data = staffRows.length > 0 ? [...staffRows, summaryRow] : [summaryRow];
    }
    else if (reportType === 'driver_income') {
       let driverQuery = {};
       const queryBranchId = req.query.branchId || req.headers['x-branch-id'];
       let targetBranchId = null;
       if (queryBranchId && queryBranchId !== 'all' && queryBranchId !== 'undefined' && queryBranchId !== 'null') {
         targetBranchId = queryBranchId;
       } else if (req.user.role !== 'Super Admin' && req.user.branch) {
         targetBranchId = req.user.branch;
       }

       if (targetBranchId) {
         const branchObj = await Branch.findById(targetBranchId);
         if (branchObj) {
           driverQuery.branch = branchObj.name;
         } else {
           driverQuery.branch = 'NON_EXISTENT_BRANCH_TO_PREVENT_LEAK';
         }
       }

       let drivers = await Driver.find(driverQuery);
       if (parameter && parameter !== 'All') {
         drivers = drivers.filter(d => d.driverName === parameter);
       }
       const activePickups = await Pickup.find({ status: { $ne: 'Completed' } });
       const activeDeliveries = await Delivery.find({ status: { $nin: ['Delivered', 'Failed'] } });

       // Fetch all completed jobs in range to perform sales revenue aggregates
       const completedDels = await Delivery.find({
         status: 'Delivered',
         ...applyDateFilter(start, end, 'deliveryDate')
       });
       const completedPups = await Pickup.find({
         status: 'Completed',
         ...applyDateFilter(start, end, 'pickupDate')
       });

       const allOrderNumbers = [
         ...completedDels.map(cd => cd.orderNumber),
         ...completedPups.map(cp => cp.orderNumber)
       ].filter(Boolean);
       const allOrders = await Order.find({ number: { $in: allOrderNumbers } });

       data = drivers.map(d => {
         const rawAreas = d.areas || (d.area ? [d.area] : []);
         const driverAreas = rawAreas.flatMap(a => typeof a === 'string' ? a.split(',').map(s => s.trim()) : a)
                                     .filter(a => a && a !== '...' && a !== '…');
         const pCount = activePickups.filter(p => p.assignedStaff === d.driverName).length;
         const dCount = activeDeliveries.filter(del => del.assignedStaff === d.driverName).length;

         const driverDels = completedDels.filter(cd => cd.assignedStaff === d.driverName);
         const driverPups = completedPups.filter(cp => cp.assignedStaff === d.driverName);
         const driverOrderNums = [
           ...driverDels.map(cd => cd.orderNumber),
           ...driverPups.map(cp => cp.orderNumber)
         ].filter(Boolean);

         const driverOrders = allOrders.filter(o => driverOrderNums.includes(o.number));
         const totalSales = driverOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
         const jobsCount = driverDels.length + driverPups.length;

         return {
           id: d._id,
           name: d.driverName,
           areas: driverAreas.join(', ') || '—',
           status: d.status || 'Available',
           activePickups: pCount,
           activeDeliveries: dCount,
           count: jobsCount,
           sales: totalSales
         };
       });
    }
    else if (reportType === 'service_revenue') {
       const dbServices = await LaundryService.find();
       const orders = await Order.find(orderFilter);
       const groups = {};
       
       const defaultServices = dbServices.length > 0
         ? dbServices.map(s => s.name)
         : ['Normal Ironing', 'Wash & Iron', 'Express Ironing', 'Express Wash & Iron'];
         
       defaultServices.forEach(name => {
         groups[name] = { service: name, count: 0, revenue: 0 };
       });

       orders.forEach(o => {
         const s = normalizeServiceName(o.serviceType || o.service, dbServices);
         if (!groups[s]) groups[s] = { service: s, count: 0, revenue: 0 };
         groups[s].count += 1;
         groups[s].revenue += (Number(o.totalAmount || o.amount) || 0);
       });
       data = Object.values(groups);
    }
    else if (reportType === 'garment_stats') {
       const orders = await Order.find(orderFilter);
       const groups = {};
       orders.forEach(o => {
         const serviceLower = (o.serviceType || 'Normal').toLowerCase();
         const isExpress = serviceLower.includes('express');
         if (parameter === 'Express' && !isExpress) return;
         if (parameter === 'Normal' && isExpress) return;

         if (o.itemDetails) {
           o.itemDetails.forEach(it => {
             if (parameter && parameter !== 'All' && parameter !== 'Express' && parameter !== 'Normal' && it.name !== parameter) return;
             if (!groups[it.name]) groups[it.name] = { name: it.name, qty: 0, revenue: 0 };
             groups[it.name].qty += it.quantity;
             groups[it.name].revenue += it.quantity * it.unitPrice;
           });
         }
       });
       data = Object.values(groups).sort((a, b) => b.qty - a.qty);
    }
    
    res.json({ data });
  } catch (error) {
    console.error('Reports Generate Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
