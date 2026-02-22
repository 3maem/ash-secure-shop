import { AshMemoryStore } from '@3maem/ash-node-sdk';

export const ashStore = new AshMemoryStore({
  ttlSeconds: 300,
  cleanupIntervalSeconds: 60,
});
