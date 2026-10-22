const bookings = require('./lib/bookings');
const backup = require('./lib/backup');

const timers = [];

function every(ms, name, fn) {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await fn();
    } catch (err) {
      console.error(`[job:${name}]`, err);
    } finally {
      running = false;
    }
  };
  timers.push(setTimeout(run, 2000).unref());
  timers.push(setInterval(run, ms).unref());
}

function start() {
  // Confirms payments whose callback never arrived, then releases unpaid holds.
  every(30 * 1000, 'payments', async () => {
    await bookings.pollPendingPayments();
    await bookings.expireHolds();
  });
  every(5 * 60 * 1000, 'reminders', () => bookings.sendReminders());
  every(30 * 60 * 1000, 'backup', () => backup.dailyIfDue());
}

function stop() {
  for (const t of timers) clearInterval(t);
  timers.length = 0;
}

module.exports = { start, stop };
