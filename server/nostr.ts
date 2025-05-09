import { SimplePool, getEventHash, getPublicKey, finalizeEvent, type Event } from 'nostr-tools';

const NOSTR_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band'
];

// Initialize Nostr connection pool
const pool = new SimplePool();

// Get the private key from environment variables
const privateKey = process.env.NOSTR_PRIVATE_KEY;
if (!privateKey) {
  console.error('NOSTR_PRIVATE_KEY is not set in environment variables');
}

// Create high five note and publish to Nostr
export async function publishHighFiveToNostr(highFive: {
  recipient: string;
  reason: string;
  amount: number;
  sender?: string;
}): Promise<void> {
  try {
    if (!privateKey) {
      console.error('Cannot publish to Nostr: NOSTR_PRIVATE_KEY is not set');
      return;
    }

    const publicKey = getPublicKey(privateKey);
    console.log(`Publishing High Five to Nostr using public key: ${publicKey}`);

    // Format the content of the Nostr note
    const content = formatHighFiveContent(highFive);

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
      unsignedEvent.tags.push(['p', highFive.recipient]);
    }

    // Finalize the event (sign it)
    const signedEvent = finalizeEvent(unsignedEvent, privateKey);

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