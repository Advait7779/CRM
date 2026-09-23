const { prisma } = require('../config/prisma');
const { currentDateOnly, prepareData, toDateOnly } = require('../utils/prismaData');
const { sendMultiChannelNotification } = require('./notificationService');

async function processRenewalReminders() {
  const today = toDateOnly(currentDateOnly());
  const sevenDays = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const oldestReminderDate = new Date(today);
  oldestReminderDate.setFullYear(oldestReminderDate.getFullYear() - 1);
  const [renewals, recipients] = await Promise.all([
    prisma.renewals.findMany({
      where: { nextDue: { gte: oldestReminderDate, lte: sevenDays } }
    }),
    prisma.users.findMany({
      where: { role: { in: ['super_admin', 'director', 'accounts', 'sales_manager', 'sales_executive'] } },
      select: { id: true }
    })
  ]);

  for (const renewal of renewals) {
    const due = new Date(renewal.nextDue);
    const daysLeft = Math.ceil((due - today) / (24 * 60 * 60 * 1000));
    const status = daysLeft < 0 ? 'Overdue' : daysLeft <= 7 ? 'Due Soon' : 'Active';
    await prisma.renewals.update({
      where: { id: renewal.id },
      data: prepareData('renewals', { daysLeft, status })
    });

    const title = daysLeft < 0 ? 'Overdue renewal' : 'Renewal due soon';
    const dueDate = renewal.nextDue.toISOString().slice(0, 10);
    const message = `${renewal.customer}: ${renewal.type} (${dueDate})`;
    let createdAny = false;
    for (const user of recipients) {
      const existing = await prisma.notifications.findFirst({
        where: {
          userId: user.id,
          title,
          message
        }
      });
      if (!existing) {
        await prisma.notifications.create({
          data: prepareData('notifications', {
            userId: user.id,
            type: 'renewal_reminder',
            title,
            message,
            link: '/renewals'
          }, { create: true })
        });
        createdAny = true;
      }
    }

    if (createdAny) {
      const customer = await prisma.customers.findFirst({ where: { name: renewal.customer } });
      await sendMultiChannelNotification({
        toEmail: customer?.email,
        toPhone: customer?.phone,
        subject: `${renewal.type} renewal reminder`,
        textContent: `Your ${renewal.type} service is ${daysLeft < 0 ? 'overdue' : `due on ${dueDate}`}.`
      });
    }
  }
}

function startScheduler() {
  if (String(process.env.ENABLE_SCHEDULER || 'true').toLowerCase() === 'false') {
    console.log('Background scheduler is disabled.');
    return () => {};
  }

  const run = () => processRenewalReminders().catch(error => {
    console.error('Renewal reminder job failed:', error.message);
  });
  const startupTimer = setTimeout(run, 15000);
  const interval = setInterval(run, 6 * 60 * 60 * 1000);
  startupTimer.unref();
  interval.unref();
  console.log('Renewal reminder scheduler enabled.');

  return () => {
    clearTimeout(startupTimer);
    clearInterval(interval);
  };
}

module.exports = { processRenewalReminders, startScheduler };
