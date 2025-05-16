import { SimplePool, getEventHash, getPublicKey, finalizeEvent, nip19, type Event } from 'nostr-tools';
import WebSocket from 'ws';

// Setup WebSocket for Node environment
if (typeof global !== 'undefined') {
  (global as any).WebSocket = WebSocket;
}

const NOSTR_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band'
];

// Initialize Nostr connection pool
const pool = new SimplePool();

// Create high five note and publish to Nostr
export async function publishHighFiveToNostr(highFive: {
  recipient: string;
  reason: string;
  amount: number;
  sender?: string;
  lightningInvoice?: string;
}): Promise<void> {
  try {
    // Get the private key from environment variables
    const privateKeyHex = process.env.NOSTR_PRIVATE_KEY;
    if (!privateKeyHex) {
      console.error('Cannot publish to Nostr: NOSTR_PRIVATE_KEY is not set');
      return;
    }

    // Handle nsec format if needed
    let hexKey = privateKeyHex;
    if (privateKeyHex.startsWith('nsec')) {
      try {
        const { data } = nip19.decode(privateKeyHex);
        hexKey = data as string;
      } catch (e) {
        console.error('Invalid nsec key:', e);
        return;
      }
    }

    // Get public key from private key
    const publicKey = getPublicKey(hexKey);
    console.log(`Publishing High Five to Nostr using public key: ${publicKey}`);

    // Format the content of the Nostr note
    const content = highFive.lightningInvoice 
      ? formatContentWithLightningInvoice(highFive) 
      : formatHighFiveContent(highFive);
    
    // Create an unsigned event
    const unsignedEvent: Event = {
      kind: 1, // Regular note
      pubkey: publicKey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['t', 'highfive'], // Tag for filtering/indexing
        ['amount', highFive.amount.toString()]
      ],
      content,
      id: '',
      sig: '',
    };

    // Add recipient tag if it looks like a npub
    if (highFive.recipient.startsWith('npub')) {
      try {
        const { data } = nip19.decode(highFive.recipient);
        unsignedEvent.tags.push(['p', data as string]);
      } catch (e) {
        console.error('Invalid npub recipient:', e);
      }
    }

    // Finalize the event (sign it)
    const signedEvent = finalizeEvent(unsignedEvent, hexKey);

    // Publish to all configured relays
    const pubs = pool.publish(NOSTR_RELAYS, signedEvent);
    
    // Wait for at least one relay to accept the event
    await Promise.any(pubs);
    
    console.log('High Five successfully published to Nostr');
  } catch (error) {
    // Don't let Nostr errors affect the main application
    console.error('Error publishing to Nostr:', error);
  }
}

function formatHighFiveContent(highFive: {
  recipient: string;
  reason: string;
  amount: number;
  sender?: string;
}): string {
  const parts = [
    `🖐️ High Five of ${highFive.amount} sats`,
    `To: ${highFive.recipient}`,
    highFive.sender ? `From: ${highFive.sender}` : 'From: Anonymous',
    '',
    highFive.reason,
    '',
    '#highfives'
  ];

  return parts.join('\n');
}

// Format content with Lightning invoice for Nostr clients to display as QR code
function formatContentWithLightningInvoice(highFive: {
  recipient: string;
  reason: string;
  amount: number;
  sender?: string;
  lightningInvoice?: string;
}): string {
  // Basic content without Lightning invoice
  const basicContent = [
    `🖐️ High Five of ${highFive.amount} sats`,
    `To: ${highFive.recipient}`,
    highFive.sender ? `From: ${highFive.sender}` : 'From: Anonymous',
    '',
    highFive.reason,
    '',
  ];

  // Add Lightning invoice if available - Nostr clients recognize this format
  if (highFive.lightningInvoice) {
    basicContent.push('');
    basicContent.push('Scan this QR code to send Bitcoin:');
    basicContent.push('');
    // Many Nostr clients will render lightning: prefixed text as QR codes automatically
    basicContent.push(`lightning:${highFive.lightningInvoice}`);
  }

  // Add hashtag
  basicContent.push('');
  basicContent.push('#highfives');

  return basicContent.join('\n');
}