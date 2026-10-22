import * as bookings from './lib/bookings.js';
import * as backup from './lib/backup.js';
import { shared } from './lib/shared.js';

const timers = shared('jobTimers', () => []);

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
  if (timers.length) return;
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

export { start, stop };
