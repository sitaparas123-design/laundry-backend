require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Role = require('../models/Role');
const Branch = require('../models/Branch');
const User = require('../models/User');
const Driver = require('../models/Driver');
const LaundryService = require('../models/LaundryService');
const Setting = require('../models/Setting');

const rolesData = [
  {
    name: 'Super Admin',
    description: 'Global system controller with root permissions',
    permissions: [
      'view_dashboard', 'manage_customers', 'manage_orders', 'create_orders',
      'view_orders', 'track_orders', 'manage_services', 'manage_pricing',
      'manage_pickups', 'view_pickups', 'manage_deliveries', 'view_deliveries',
      'manage_payments', 'manage_staff', 'manage_roles', 'view_reports',
      'manage_settings', 'view_analytics', 'export_data', 'manage_permissions'
    ]
  },
  {
    name: 'Admin',
    description: 'Branch manager administrative role',
    permissions: [
      'view_dashboard', 'manage_customers', 'manage_orders', 'create_orders',
      'view_orders', 'track_orders', 'manage_services', 'manage_pricing',
      'manage_pickups', 'view_pickups', 'manage_deliveries', 'view_deliveries',
      'manage_payments', 'manage_staff', 'manage_roles', 'view_reports',
      'manage_settings', 'view_analytics', 'export_data', 'manage_permissions'
    ]
  },
  {
    name: 'Counter Staff',
    description: 'Counter operations and billing',
    permissions: [
      'view_dashboard', 'manage_customers', 'create_orders', 'view_orders',
      'manage_payments', 'track_orders', 'view_pickups', 'view_deliveries'
    ]
  },
  {
    name: 'Delivery Staff',
    description: 'Logistics collections and deliveries',
    permissions: [
      'view_dashboard', 'view_assigned_pickups', 'update_pickup_status',
      'view_assigned_deliveries', 'update_delivery_status', 'view_completed_jobs',
      'view_route_map'
    ]
  }
];

const branchesData = [
  { name: 'Ragheey', address: 'Ragheey Area Block 4', phone: '99999991', manager: 'Dana Lee', status: 'Active' },
  { name: 'Mishrif', address: 'Mishrif Area Block 2', phone: '99999992', manager: 'Marcus Johnson', status: 'Active' },
  { name: 'Andalus', address: 'Andalus Area Block 1', phone: '99999993', manager: 'Patricia Wong', status: 'Active' },
  { name: 'Home Service', address: 'Home Service Central Hub', phone: '99999994', manager: 'Logistics Manager', status: 'Active' }
];

const servicesData = [
  { name: 'Wash & Fold', category: 'Washing', price: 2.5, estimatedTime: '24 hours', status: 'Active', description: 'Standard wash and fold service' },
  { name: 'Dry Cleaning', category: 'Dry Cleaning', price: 5.0, estimatedTime: '48 hours', status: 'Active', description: 'Professional dry cleaning' },
  { name: 'Ironing', category: 'Ironing', price: 1.5, estimatedTime: '12 hours', status: 'Active', description: 'Professional ironing service' },
  { name: 'Wash & Iron', category: 'Wash & Iron', price: 4.0, estimatedTime: '36 hours', status: 'Active', description: 'Wash and iron combined' },
  { name: 'Premium Care', category: 'Premium Care', price: 8.0, estimatedTime: '72 hours', status: 'Active', description: 'Delicate fabric care' },
  { name: 'Stain Removal', category: 'Premium Care', price: 3.5, estimatedTime: '48 hours', status: 'Active', description: 'Special stain treatment' },
  { name: 'Express Wash', category: 'Washing', price: 4.5, estimatedTime: '6 hours', status: 'Active', description: 'Fast turnaround wash' },
  { name: 'Blanket Cleaning', category: 'Washing', price: 6.0, estimatedTime: '48 hours', status: 'Active', description: 'Large item cleaning' },
  { name: 'Wool Care', category: 'Premium Care', price: 7.0, estimatedTime: '72 hours', status: 'Inactive', description: 'Specialized wool cleaning' },
  { name: 'Silk Handling', category: 'Premium Care', price: 9.0, estimatedTime: '72 hours', status: 'Active', description: 'Delicate silk treatment' },
  { name: 'Wedding Dress', category: 'Premium Care', price: 25.0, estimatedTime: '7 days', status: 'Active', description: 'Special occasion dress care' },
  { name: 'Leather Cleaning', category: 'Premium Care', price: 12.0, estimatedTime: '72 hours', status: 'Active', description: 'Leather item care' },
  { name: 'Uniform Cleaning', category: 'Dry Cleaning', price: 3.0, estimatedTime: '24 hours', status: 'Active', description: 'Professional uniform cleaning' },
  { name: 'Suit Pressing', category: 'Ironing', price: 2.5, estimatedTime: '12 hours', status: 'Active', description: 'Suit dry cleaning and pressing' },
  { name: 'Bulk Wash', category: 'Washing', price: 1.5, estimatedTime: '24 hours', status: 'Active', description: 'Discounted bulk service' }
];

const seedDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/spinclean-laundry';
    await mongoose.connect(mongoUri);
    console.log('Seed: Connected to Database.');

    // Clear existing collections
    await Role.deleteMany({});
    await Branch.deleteMany({});
    await User.deleteMany({});
    await Driver.deleteMany({});
    await LaundryService.deleteMany({});
    await Setting.deleteMany({});
    console.log('Seed: Cleaned existing collections.');

    // Insert Roles
    const createdRoles = await Role.insertMany(rolesData);
    console.log(`Seed: Loaded ${createdRoles.length} roles.`);

    const superAdminRole = createdRoles.find(r => r.name === 'Super Admin');
    const adminRole = createdRoles.find(r => r.name === 'Admin');
    const counterRole = createdRoles.find(r => r.name === 'Counter Staff');
    const deliveryRole = createdRoles.find(r => r.name === 'Delivery Staff');

    // Insert Branches
    const createdBranches = await Branch.insertMany(branchesData);
    console.log(`Seed: Loaded ${createdBranches.length} branches.`);

    const ragheeyBranch = createdBranches.find(b => b.name === 'Ragheey');
    const mishrifBranch = createdBranches.find(b => b.name === 'Mishrif');
    const andalusBranch = createdBranches.find(b => b.name === 'Andalus');

    // Insert Laundry Services
    await LaundryService.insertMany(servicesData);
    console.log(`Seed: Loaded laundry services catalog.`);

    // Insert Global Settings
    const defaultSettings = new Setting({
      key: 'spinclean-settings',
      business: {
        businessName: 'Tuhama PRO',
        ownerName: 'Dana Lee',
        email: 'admin@tuhama.com',
        phone: '555-0001',
        address: '100 Executive Blvd, New York, NY 10001',
        gstNumber: 'GST-29ABCDE1234F1Z5',
        website: 'https://tuhama.com'
      },
      system: {
        currency: 'KWD',
        timezone: 'Asia/Kuwait',
        dateFormat: 'DD/MM/YYYY',
        defaultDeliveryTime: '48 hours'
      }
    });
    await defaultSettings.save();
    console.log('Seed: Created default global settings.');

    // Insert Users
    const usersData = [
      // Super Admin
      {
        name: 'Super Admin',
        email: 'superadmin@tuhama.com',
        phone: '555-0000',
        address: 'HQ Office',
        username: 'superadmin',
        passwordHash: 'admin123', // hooks will auto hash
        role: superAdminRole._id,
        branch: null,
        status: 'Active'
      },
      // Admins
      {
        name: 'Dana Lee',
        email: 'dana@tuhama.com',
        phone: '555-0001',
        address: '100 Executive Blvd',
        username: 'danalee',
        passwordHash: 'admin123',
        role: adminRole._id,
        branch: ragheeyBranch._id,
        status: 'Active'
      },
      {
        name: 'Marcus Johnson',
        email: 'marcus@tuhama.com',
        phone: '555-0002',
        address: '105 Corporate Ave',
        username: 'marcusj',
        passwordHash: 'admin123',
        role: adminRole._id,
        branch: mishrifBranch._id,
        status: 'Active'
      },
      {
        name: 'Patricia Wong',
        email: 'patricia@tuhama.com',
        phone: '555-0003',
        address: '110 Business Ln',
        username: 'patriciaw',
        passwordHash: 'admin123',
        role: adminRole._id,
        branch: andalusBranch._id,
        status: 'Active'
      },
      // Counter Staff
      {
        name: 'Evan Wu',
        email: 'evan@tuhama.com',
        phone: '555-0004',
        address: '200 Main St',
        username: 'evanwu',
        passwordHash: 'staff123',
        role: counterRole._id,
        branch: ragheeyBranch._id,
        status: 'Active'
      },
      {
        name: 'Sarah Martinez',
        email: 'sarah@tuhama.com',
        phone: '555-0005',
        address: '205 Park Ave',
        username: 'sarahm',
        passwordHash: 'staff123',
        role: counterRole._id,
        branch: ragheeyBranch._id,
        status: 'Active'
      },
      {
        name: 'Kevin Park',
        email: 'kevin@tuhama.com',
        phone: '555-0006',
        address: '210 Oak Street',
        username: 'kevinp',
        passwordHash: 'staff123',
        role: counterRole._id,
        branch: mishrifBranch._id,
        status: 'Active'
      },
      {
        name: 'Lisa Thompson',
        email: 'lisa@tuhama.com',
        phone: '555-0007',
        address: '215 Elm Rd',
        username: 'lisat',
        passwordHash: 'staff123',
        role: counterRole._id,
        branch: mishrifBranch._id,
        status: 'Active'
      },
      // Delivery Staff
      {
        name: 'Frank Brown',
        email: 'frank@tuhama.com',
        phone: '555-0012',
        address: '300 Industrial Ave',
        username: 'frankb',
        passwordHash: 'rider123',
        role: deliveryRole._id,
        branch: ragheeyBranch._id,
        status: 'Active'
      },
      {
        name: 'Henry Miller',
        email: 'henry@tuhama.com',
        phone: '555-0013',
        address: '305 Commerce Blvd',
        username: 'henrym',
        passwordHash: 'rider123',
        role: deliveryRole._id,
        branch: ragheeyBranch._id,
        status: 'Active'
      },
      {
        name: 'Robert Garcia',
        email: 'robert@tuhama.com',
        phone: '555-0014',
        address: '310 Factory Rd',
        username: 'robertg',
        passwordHash: 'rider123',
        role: deliveryRole._id,
        branch: mishrifBranch._id,
        status: 'Active'
      },
      {
        name: 'Carlos Mendez',
        email: 'carlos@tuhama.com',
        phone: '555-0015',
        address: '315 Warehouse St',
        username: 'carlasm',
        passwordHash: 'rider123',
        role: deliveryRole._id,
        branch: mishrifBranch._id,
        status: 'Active'
      }
    ];

    const createdUsers = [];
    for (const u of usersData) {
      const userDoc = new User(u);
      await userDoc.save();
      createdUsers.push(userDoc);
    }
    console.log(`Seed: Loaded ${createdUsers.length} users/staff accounts.`);

    // Insert Drivers info for Delivery Staff users
    const frankUser = createdUsers.find(u => u.username === 'frankb');
    const henryUser = createdUsers.find(u => u.username === 'henrym');
    const robertUser = createdUsers.find(u => u.username === 'robertg');
    const carlosUser = createdUsers.find(u => u.username === 'carlasm');

    const driversData = [
      {
        user: frankUser._id,
        driverNo: 'DRV-100',
        driverName: frankUser.name,
        mobile: frankUser.phone,
        areas: ['Salmiya', 'Ragheey'],
        carNo: 'CAR-1000',
        civilId: 'CIVIL-001',
        nationality: 'Kuwaiti',
        branch: 'Ragheey',
        status: 'Available'
      },
      {
        user: henryUser._id,
        driverNo: 'DRV-101',
        driverName: henryUser.name,
        mobile: henryUser.phone,
        areas: ['Mishrif'],
        carNo: 'CAR-1001',
        civilId: 'CIVIL-002',
        nationality: 'Kuwaiti',
        branch: 'Ragheey',
        status: 'Available'
      },
      {
        user: robertUser._id,
        driverNo: 'DRV-102',
        driverName: robertUser.name,
        mobile: robertUser.phone,
        areas: ['Andalus'],
        carNo: 'CAR-1002',
        civilId: 'CIVIL-003',
        nationality: 'Egyptian',
        branch: 'Mishrif',
        status: 'Available'
      },
      {
        user: carlosUser._id,
        driverNo: 'DRV-103',
        driverName: carlosUser.name,
        mobile: carlosUser.phone,
        areas: ['Hawally'],
        carNo: 'CAR-1003',
        civilId: 'CIVIL-004',
        nationality: 'Indian',
        branch: 'Mishrif',
        status: 'Available'
      }
    ];

    await Driver.insertMany(driversData);
    console.log('Seed: Loaded logistic drivers catalog.');

    await mongoose.disconnect();
    console.log('Seed: Disconnected from Database. Seeding completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seedDB();
