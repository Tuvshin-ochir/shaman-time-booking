// Isolated database for each test file (node --test runs files in separate processes).
import './env.js';
import { seed } from '../src/seed.js';
import { ensureAdmin } from '../src/lib/auth.js';

seed();
ensureAdmin();
