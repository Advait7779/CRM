const bcrypt = require('bcryptjs');
const { connectDB, prisma } = require('./config/prisma');
const { prepareData } = require('./utils/prismaData');

async function migrate() {
  await connectDB();
  console.log('Prisma migrations are applied.');

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME || 'Super Admin';

  if (adminEmail && adminPassword) {
    if (adminPassword.length < 12) {
      throw new Error('ADMIN_PASSWORD must be at least 12 characters.');
    }
    const email = adminEmail.toLowerCase();
    const existing = await prisma.users.findUnique({ where: { email } });
    if (!existing) {
      await prisma.users.create({
        data: prepareData('users', {
        name: adminName,
        email,
        password: await bcrypt.hash(adminPassword, 12),
        role: 'super_admin'
        }, { create: true })
      });
      console.log('Initial administrator created.');
    } else {
      console.log('Administrator already exists.');
    }
  }
}

if (require.main === module) {
  migrate()
    .then(() => prisma.$disconnect())
    .catch(async (error) => {
      console.error('Database migration failed:', error.message);
      try { await prisma.$disconnect(); } catch {}
      process.exit(1);
    });
}

module.exports = { migrate };
