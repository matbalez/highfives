import { SimplePool } from 'nostr-tools';

/**
 * Set up and return a SimplePool connected to specified relays
 */
export function setupNostrPool(relays: string[]): SimplePool {
  const pool = new SimplePool();
  return pool;
}