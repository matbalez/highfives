import { SimplePool, finalizeEvent, getPublicKey, nip19, nip04, type Event } from 'nostr-tools';
import WebSocket from 'ws';

// Use WebSocket polyfill for Node.js environment
if (typeof global !== 'undefined') {
  (global as any).WebSocket = WebSocket;
}

// List of Nostr relays to publish to - using more relays for better delivery
const NOSTR_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://nostr.wine',
  'wss://relay.current.fyi',
  'wss://relay.snort.social'
];

// Initialize Nostr connection pool
const pool = new SimplePool();

// Send a direct message to a Nostr user
export async function sendNostrDM(recipientPubkey: string, message: string): Promise<boolean> {
  try {
    console.log(`Attempting to send Nostr DM to: ${recipientPubkey}`);
    
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

    // Convert npub to hex if needed
    let recipientPubkeyHex = recipientPubkey;
    if (recipientPubkey.startsWith('npub')) {
      try {
        const { data } = nip19.decode(recipientPubkey);
        recipientPubkeyHex = data as string;
        console.log(`Converted npub to hex pubkey: ${recipientPubkeyHex}`);
      } catch (e) {
        console.error('Invalid npub recipient:', e);
        return false;
      }
    }

    // Get public key from private key
    const publicKey = getPublicKey(hexKey as unknown as Uint8Array);
    console.log(`Sending Nostr DM from public key: ${publicKey} to recipient: ${recipientPubkeyHex}`);
    
    // Encrypt the message content using NIP-04
    let encryptedContent: string;
    try {
      encryptedContent = await nip04.encrypt(hexKey as unknown as Uint8Array, recipientPubkeyHex, message);
      console.log('Successfully encrypted the message content');
    } catch (encryptError) {
      console.error('Failed to encrypt message:', encryptError);
      return false;
    }

    // Create a direct message event
    const dmEvent: Event = {
      kind: 4, // kind 4 is for encrypted direct messages
      pubkey: publicKey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['p', recipientPubkeyHex] // p tag for recipient
      ],
      content: encryptedContent, // Properly encrypted content
      id: '',
      sig: ''
    };

    console.log(`Created DM event with encrypted content: ${encryptedContent.substring(0, 20)}...`);

    // Sign the event
    const signedEvent = finalizeEvent(dmEvent, hexKey as unknown as Uint8Array);
    console.log(`Signed event with ID: ${signedEvent.id}`);

    // Publish to relays
    console.log(`Publishing to ${NOSTR_RELAYS.length} relays...`);
    const pubs = pool.publish(NOSTR_RELAYS, signedEvent);
    
    try {
      // Wait for at least one successful publication
      const pub = await Promise.any(pubs);
      console.log(`DM successfully sent via relay: ${pub.url}`);
      return true;
    } catch (pubError) {
      console.error('Failed to publish to any relay:', pubError);
      return false;
    }
  } catch (error) {
    console.error('Error sending Nostr DM:', error);
    return false;
  }
}