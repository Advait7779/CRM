const { prisma } = require('../config/prisma');

async function main() {
  const tables = await prisma.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  for (const row of tables) {
    const table = row.table_name;
    const cols = await prisma.$queryRawUnsafe(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${table}' ORDER BY ordinal_position`);
    console.log(`\n=== Table: ${table} ===`);
    console.log(cols.map(c => `${c.column_name} (${c.data_type})`).join(', '));
  }
}

main().catch(e => console.error('ERROR:', e.message)).finally(() => process.exit(0));
