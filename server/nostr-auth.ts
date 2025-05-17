import { SimplePool, finalizeEvent, getPublicKey, nip19, nip04, type Event } from 'nostr-tools';
import WebSocket from 'ws';
import crypto from 'crypto';

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

// Map to store pending verification PINs
// In a production app, this should use a database
const pendingVerifications = new Map<string, { pin: string, timestamp: number }>();

// Function to generate a random 4-digit PIN
function generatePin(): string {
  // Generate a random number between 1000 and 9999
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Function to convert npub to hex format
function npubToHex(npub: string): string {
  try {
    const { data } = nip19.decode(npub);
    return data as string;
  } catch (error) {
    throw new Error('Invalid npub format');
  }
}

// Send a verification PIN via Nostr DM
export async function sendVerificationPin(recipientNpub: string): Promise<{ pin: string }> {
  try {
    // Get private key from environment variables
    const privateKeyHex = process.env.NOSTR_PRIVATE_KEY;
    if (!privateKeyHex) {
      throw new Error('Nostr private key not configured');
    }

    // Handle nsec format if needed
    let hexKey = privateKeyHex;
    if (typeof privateKeyHex === 'string' && privateKeyHex.startsWith('nsec')) {
      try {
        const { data } = nip19.decode(privateKeyHex);
        hexKey = data as string;
      } catch (e) {
        throw new Error('Invalid Nostr private key format');
      }
    }

    // Get public key from private key
    const senderPubkeyHex = getPublicKey(hexKey as unknown as Uint8Array);
    
    // Convert recipient npub to hex format
    const recipientPubkeyHex = npubToHex(recipientNpub);
    
    // Generate a 4-digit PIN
    const pin = generatePin();
    
    // Store the PIN for verification
    pendingVerifications.set(recipientNpub, {
      pin,
      timestamp: Date.now()
    });
    
    // Set PIN expiration (10 minutes)
    setTimeout(() => {
      pendingVerifications.delete(recipientNpub);
    }, 10 * 60 * 1000);
    
    // Encrypt the message content using NIP-04
    const content = await nip04.encrypt(
      hexKey as unknown as Uint8Array,
      recipientPubkeyHex,
      `Your High Fives verification PIN is: ${pin}. This PIN will expire in 10 minutes.`
    );
    
    // Create a direct message event (kind 4)
    const event: Event = {
      kind: 4, // Encrypted direct message
      pubkey: senderPubkeyHex,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['p', recipientPubkeyHex], // Tag the recipient
      ],
      content,
      id: '',
      sig: '',
    };
    
    // Sign and publish the event
    const signedEvent = finalizeEvent(event, hexKey as unknown as Uint8Array);
    const pubs = pool.publish(NOSTR_RELAYS, signedEvent);
    
    // Wait for at least one successful publication
    await Promise.any(pubs);
    
    console.log(`Verification PIN sent to ${recipientNpub}`);
    
    // Return the PIN (in a real app, we would only store it, not return it)
    return { pin };
  } catch (error) {
    console.error('Error sending verification PIN:', error);
    throw error;
  }
}

// Verify the PIN entered by the user
export function verifyPin(npub: string, enteredPin: string): boolean {
  const verification = pendingVerifications.get(npub);
  
  if (!verification) {
    return false; // No verification found for this npub
  }
  
  // Check if the PIN has expired (10 minutes)
  if (Date.now() - verification.timestamp > 10 * 60 * 1000) {
    pendingVerifications.delete(npub);
    return false;
  }
  
  // Check if the PIN matches
  const isValid = verification.pin === enteredPin;
  
  // Remove the verification data after a successful attempt
  if (isValid) {
    pendingVerifications.delete(npub);
  }
  
  return isValid;
}