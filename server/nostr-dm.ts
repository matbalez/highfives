import { SimplePool, finalizeEvent, getPublicKey, nip19, type Event } from 'nostr-tools';
import WebSocket from 'ws';

// Use WebSocket polyfill for Node.js environment
if (typeof global !== 'undefined') {
  (global as any).WebSocket = WebSocket;
}

// List of Nostr relays to publish to
const NOSTR_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band'
];

// Initialize Nostr connection pool
const pool = new SimplePool();

// Send a direct message to a Nostr user
export async function sendNostrDM(recipientPubkey: string, message: string): Promise<boolean> {
  try {
    // Get private key from environment variables
    const privateKeyHex = process.env.NOSTR_PRIVATE_KEY;
    if (!privateKeyHex) {
      console.error('Cannot send DM: NOSTR_PRIVATE_KEY is not set');
      return false;
    }

    // Handle nsec format if needed
    let hexKey = privateKeyHex;
    if (privateKeyHex.startsWith('nsec')) {
      try {
        const { data } = nip19.decode(privateKeyHex);
        hexKey = data as string;
      } catch (e) {
        console.error('Invalid nsec key:', e);
        return false;
      }
    }

    // Get public key from private key
    const publicKey = getPublicKey(hexKey as unknown as Uint8Array);
    console.log(`Sending Nostr DM from public key: ${publicKey}`);

    // Create a direct message event
    const dmEvent: Event = {
      kind: 4, // kind 4 is for encrypted direct messages
      pubkey: publicKey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['p', recipientPubkey] // p tag for recipient
      ],
      content: message, // In a real app, this should be encrypted
      id: '',
      sig: ''
    };

    // Sign the event
    const signedEvent = finalizeEvent(dmEvent, hexKey as unknown as Uint8Array);

    // Publish to relays
    const pubs = pool.publish(NOSTR_RELAYS, signedEvent);
    
    // Wait for at least one successful publication
    await Promise.any(pubs);
    
    console.log('DM successfully sent via Nostr');
    return true;
  } catch (error) {
    console.error('Error sending Nostr DM:', error);
    return false;
  }
}