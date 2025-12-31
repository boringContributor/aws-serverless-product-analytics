export * from './types';
export { DSQLAdapter } from './dsql/adapter';

import type { StorageAdapter } from './types';
import { DSQLAdapter } from './dsql/adapter';

let storage: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (!storage) {
    // Initialize Amazon DSQL adapter
    storage = new DSQLAdapter({
      type: 'dsql',
      host: process.env.DSQL_HOST || '',
      username: process.env.DSQL_USERNAME || 'admin',
      database: 'analytics',
    });
  }
  return storage;
}