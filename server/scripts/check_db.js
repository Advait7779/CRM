const { prisma } = require('../config/prisma');

async function main() {
  // Check Renewals amount column type
  const renewalsCols = await prisma.$queryRawUnsafe(
    "SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = 'Renewals' ORDER BY ordinal_position"
  );
  console.log('Renewals columns:', JSON.stringify(renewalsCols, null, 2));

  // Check Leads columns  
  const leadsCols = await prisma.$queryRawUnsafe(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Leads' ORDER BY ordinal_position"
  );
  console.log('Leads columns:', JSON.stringify(leadsCols, null, 2));

  // Check Notifications columns
  const notifCols = await prisma.$queryRawUnsafe(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Notifications' ORDER BY ordinal_position"
  );
  console.log('Notifications columns:', JSON.stringify(notifCols, null, 2));
}

main().catch(e => console.error('ERROR:', e.message)).finally(() => process.exit(0));
