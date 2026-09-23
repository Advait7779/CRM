const bcrypt = require('bcryptjs');
const { prisma, connectDB } = require('../config/prisma');

async function setupChatTable() {
  await connectDB();
  console.log('Ensuring ChatMessages & ChatGroups tables exist...');
  
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ChatMessages" (
      "id" SERIAL PRIMARY KEY,
      "senderId" INTEGER NOT NULL,
      "receiverId" INTEGER,
      "groupId" INTEGER,
      "message" TEXT NOT NULL,
      "attachment" VARCHAR(255),
      "attachmentName" VARCHAR(255),
      "read" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // In case table already existed without groupId or with non-null receiverId
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "ChatMessages" ADD COLUMN IF NOT EXISTS "groupId" INTEGER;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ChatMessages" ALTER COLUMN "receiverId" DROP NOT NULL;`);
  } catch (e) {
    console.log('Column adjustment:', e.message);
  }
  
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ChatGroups" (
      "id" SERIAL PRIMARY KEY,
      "name" VARCHAR(255) NOT NULL,
      "description" TEXT,
      "avatarColor" VARCHAR(50) DEFAULT '#10b981',
      "createdBy" INTEGER NOT NULL,
      "members" JSONB,
      "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "chat_messages_sender_receiver" ON "ChatMessages" ("senderId", "receiverId");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "chat_messages_group_id" ON "ChatMessages" ("groupId");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "chat_messages_receiver_read" ON "ChatMessages" ("receiverId", "read");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "chat_messages_created_at" ON "ChatMessages" ("createdAt");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "chat_groups_created_at" ON "ChatGroups" ("createdAt");
  `);

  console.log('Tables & indexes ready.');

  // Seed Image 2 contacts into users table if they don't exist
  const password = await bcrypt.hash('DemoPass@12345', 12);
  const sampleContacts = [
    { name: 'Pramod Joshi', email: 'pramod@company.com', role: 'sales_executive', phone: '9876500001', initialMsg: '?' },
    { name: 'shriram traders', email: 'shriram@traders.com', role: 'sales_manager', phone: '9876500002', initialMsg: 'qty' },
    { name: 'Innovation Solutions', email: 'contact@innovationsol.com', role: 'website_developer', phone: '9876500003', initialMsg: 'Thank you for contacting Innovation Solut...' },
    { name: 'Matoshree net cafe', email: 'matoshree@netcafe.com', role: 'support_executive', phone: '9876500004', initialMsg: '*JOB* *JOB* *JOB* 💻 Computer Oper...' },
    { name: 'Gautam Computer Education', email: 'gautam@education.in', role: 'digital_marketing', phone: '9876500005', initialMsg: 'आता जोईन करा KLIC Diploma Admission O...' },
    { name: 'Kumar Graphics Xerox', email: 'kumar@graphics.com', role: 'cctv_technician', phone: '9876500006', initialMsg: '🥳 🌸 🌅 Thank you for contacting *K...' },
    { name: 'INTEGRAL COMPUTER', email: 'integral@computer.co', role: 'gps_installer', phone: '9876500007', initialMsg: 'Thank you for contacting Integral Comput...' },
    { name: 'Tejaswi NetCafe & CSC Center', email: 'tejaswi@csc.in', role: 'accounts', phone: '9876500008', initialMsg: 'Thank you for contacting Tejaswi...' }
  ];

  const admin = await prisma.users.findFirst({ where: { role: 'super_admin' } }) || await prisma.users.findFirst();

  for (const c of sampleContacts) {
    let user = await prisma.users.findUnique({ where: { email: c.email } });
    if (!user) {
      user = await prisma.users.create({
        data: {
          name: c.name,
          email: c.email,
          password,
          phone: c.phone,
          role: c.role,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      console.log(`Created user ${c.name}`);
    }

    // Check if initial message exists
    if (admin) {
      const existing = await prisma.chatMessages.findFirst({
        where: {
          OR: [
            { senderId: user.id, receiverId: admin.id },
            { senderId: admin.id, receiverId: user.id }
          ]
        }
      });

      if (!existing) {
        await prisma.chatMessages.create({
          data: {
            senderId: user.id,
            receiverId: admin.id,
            message: c.initialMsg,
            read: c.name === 'Pramod Joshi' ? false : true,
            createdAt: new Date(Date.now() - Math.floor(Math.random() * 60 + 5) * 60000),
            updatedAt: new Date()
          }
        });
      }
    }
  }

  // Seed default group if none exist
  const groupCount = await prisma.chatGroups.count();
  if (groupCount === 0 && admin) {
    const allUserIds = (await prisma.users.findMany({ select: { id: true } })).map(u => u.id);
    await prisma.chatGroups.create({
      data: {
        name: 'CRM Core Operations',
        description: 'All departments coordinated discussion group for CRM service requests.',
        avatarColor: '#10b981',
        createdBy: admin.id,
        members: allUserIds,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    console.log('Created default group CRM Core Operations');
  }

  console.log('Chat database initialization finished successfully.');
}

setupChatTable()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error setting up chat table:', err);
    process.exit(1);
  });
