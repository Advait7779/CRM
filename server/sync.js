require('dotenv').config();

const bcrypt = require('bcryptjs');
const { prisma, connectDB } = require('./config/prisma');
const { prepareData } = require('./utils/prismaData');

async function seedDemoData() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Demo seeding is disabled in production.');
  }
  if (!process.env.DEMO_PASSWORD || process.env.DEMO_PASSWORD.length < 12) {
    throw new Error('Set DEMO_PASSWORD to at least 12 characters before running the demo seed.');
  }

  await connectDB();
  const existingUsers = await prisma.users.count();
  if (existingUsers > 0) {
    throw new Error('Demo seed requires an empty database. Existing data was not changed.');
  }

  const password = await bcrypt.hash(process.env.DEMO_PASSWORD, 12);
  await prisma.$transaction([
    prisma.users.createMany({
      data: [
        { name: 'Super Admin', email: 'admin@company.com', password, role: 'super_admin' },
        { name: 'Rahul Sharma', email: 'sales@company.com', password, role: 'sales_executive' },
        { name: 'Priya Patel', email: 'accounts@company.com', password, role: 'accounts' }
      ].map((item) => prepareData('users', item, { create: true }))
    }),
    prisma.leads.createMany({
      data: [
        { name: 'Rajesh Kumar', phone: '9876543210', email: 'rajesh@gmail.com', company: 'RK Logistics', source: 'Website', service: 'GPS Tracking', status: 'New', exec: 'Rahul Sharma', followUp: '2026-06-28', notes: 'Interested in fleet tracking for 20 vehicles.' },
        { name: 'Anita Singh', phone: '9823456789', email: 'anita@singh.co', company: 'Singh Retail', source: 'Facebook', service: 'CCTV', status: 'Demo Given', exec: 'Priya Patel', followUp: '2026-06-29', notes: 'Wants 16 channel DVR setup for warehouse.' }
      ].map((item) => prepareData('leads', item, { create: true }))
    }),
    prisma.customers.createMany({
      data: [
        { name: 'Sharma Enterprises', contact: 'Ramesh Sharma', phone: '9876543210', email: 'info@sharmaent.com', gst: '27AAAAA1111A1Z1', address: '102, Business Park, Andheri East, Mumbai, MH', services: '["GPS", "SMS"]', vehicles: 24, cctv: 0, domain: 'sharmaent.com', renewalDate: '2026-07-15', status: 'Active' },
        { name: 'Mehta Logistics', contact: 'Sanjay Mehta', phone: '9823456789', email: 'sanjay@mehtalog.in', gst: '27BBBBB2222B2Z2', address: 'Block C, Sector 15, Vashi, Navi Mumbai, MH', services: '["GPS", "CCTV", "SMS"]', vehicles: 45, cctv: 16, domain: 'mehtalogistics.in', renewalDate: '2026-07-03', status: 'Active' }
      ].map((item) => prepareData('customers', item, { create: true }))
    }),
    prisma.tasks.createMany({
      data: [
        { title: 'Prepare monthly GST report', dept: 'Accountants', assignedTo: 'Priya Patel', priority: 'High', status: 'Pending', due: '2026-06-30', desc: 'File GSTR-1 and GSTR-3B for June 2026' },
        { title: 'Follow up with Sharma Enterprises', dept: 'Sales', assignedTo: 'Rahul Sharma', priority: 'High', status: 'Ongoing', due: '2026-06-27', desc: 'Call for renewal of GPS subscription' }
      ].map((item) => prepareData('tasks', item, { create: true }))
    }),
    prisma.inventories.createMany({
      data: [
        { name: 'Ais140 GPS Device (Certified)', category: 'GPS Device', barcode: '864235002931', stock: 120, min: 20, price: '₹2,500', status: 'OK' },
        { name: 'Hikvision 2MP Dome IP Camera', category: 'CCTV Camera', barcode: '697205001928', stock: 45, min: 10, price: '₹1,800', status: 'OK' }
      ].map((item) => prepareData('inventories', item, { create: true }))
    })
  ]);

  console.log('Prisma demo seed completed successfully.');
}

seedDemoData()
  .catch((error) => {
    console.error('Failed to seed demo database:', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
