// Mutable module state (DB connection, caches, QPay token, ...) kept once per
// process. Next.js can evaluate the same module more than once (instrumentation
// and route bundles are compiled separately), so plain module variables would
// silently diverge.
const store = (globalThis.__timeBooking ??= {});

export function shared(key, create) {
  if (!(key in store)) store[key] = create();
  return store[key];
}
