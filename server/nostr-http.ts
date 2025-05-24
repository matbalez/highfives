import { SimplePool, finalizeEvent, getPublicKey, nip19, type Event } from 'nostr-tools';
import WebSocket from 'ws';
import * as QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { uploadImageToNostrBuild } from './nostr-image-upload';
import { generateAndUploadQRCode } from './blossom-client';

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

// Directory to store QR code images (for local fallback)
const QR_CODE_DIR = path.join(process.cwd(), 'public', 'qr-codes');

// Initialize Nostr connection pool
const pool = new SimplePool();

// Create QR code directory if it doesn't exist
if (!fs.existsSync(QR_CODE_DIR)) {
  fs.mkdirSync(QR_CODE_DIR, { recursive: true });
  console.log(`Created QR code directory: ${QR_CODE_DIR}`);
}
console.log(`Serving QR code images from ${QR_CODE_DIR}`);

// Generate a QR code image, upload to nostr.build, and return URL
// Generate a data URL for a QR code that can be directly embedded in Nostr posts
async function generateQRCodeDataURL(data: string): Promise<string> {
  try {
    // Generate QR code as data URL for direct embedding
    const dataUrl = await QRCode.toDataURL(data, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 256,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
    
    console.log('Generated QR code as data URL');
    return dataUrl;
  } catch (error) {
    console.error('Error generating QR code data URL:', error);
    throw error;
  }
}

// Also save a local copy for reference
export async function saveQRCodeLocally(data: string): Promise<string> {
  try {
    // Generate a unique filename
    const filename = `${crypto.randomUUID()}.png`;
    const filepath = path.join(QR_CODE_DIR, filename);
    
    // Generate the QR code as a PNG file locally
    await QRCode.toFile(filepath, data, {
      type: 'png',
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 300,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
    
    console.log(`Generated QR code image: ${filename}`);
    
    // Return the public URL
    return `/qr-codes/${filename}`;
  } catch (error) {
    console.error('Error saving QR code locally:', error);
    throw error;
  }
}

// Publish a high five to Nostr
export async function publishHighFiveToNostr(highFive: {
  recipient: string;
  reason: string;
  sender?: string;
  lightningInvoice?: string;
  lightningAddress?: string;
}): Promise<string | null> {
  try {
    // Get private key from environment variables
    const privateKeyHex = process.env.NOSTR_PRIVATE_KEY;
    if (!privateKeyHex) {
      console.error('Cannot publish to Nostr: NOSTR_PRIVATE_KEY is not set');
      return null;
    }

    // Handle nsec format if needed
    let hexKey = privateKeyHex;
    if (typeof privateKeyHex === 'string' && privateKeyHex.startsWith('nsec')) {
      try {
        const { data } = nip19.decode(privateKeyHex);
        hexKey = data as string;
      } catch (e) {
        console.error('Invalid nsec key:', e);
        return null;
      }
    }

    // Get public key from private key
    const publicKey = getPublicKey(hexKey as unknown as Uint8Array);
    console.log(`Publishing High Five to Nostr using public key: ${publicKey}`);

    // Default content without QR code
    const baseContent = formatHighFiveContent(highFive);

    // Create the base event
    const event: Event = {
      kind: 1, // Regular note
      pubkey: publicKey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['t', 'highfive'],
      ],
      content: baseContent,
      id: '',
      sig: ''
    };

    // Add recipient tag if it looks like a npub
    if (highFive.recipient.startsWith('npub')) {
      try {
        const { data } = nip19.decode(highFive.recipient);
        event.tags.push(['p', data as string]);
      } catch (e) {
        console.error('Invalid npub recipient:', e);
      }
    }
    
    // Add Lightning invoice and QR code to the Nostr post if available
    if (highFive.lightningInvoice) {
      try {
        console.log(`Adding Lightning invoice to Nostr post: ${highFive.lightningInvoice.substring(0, 15)}...`);

        // Save a local copy and get the QR code path
        const qrCodePath = await saveQRCodeLocally(highFive.lightningInvoice);
        
        // Use the specified domain for QR code URLs
        const baseUrl = 'https://highfives.fun';
        const qrCodeFullUrl = `${baseUrl}${qrCodePath}`;
        
        console.log(`QR code image URL: ${qrCodeFullUrl}`);

        // Completely replace the event content with the new format that includes the QR code image
        event.content = formatHighFiveContent({
          ...highFive,
          lightningInvoice: highFive.lightningInvoice,
          qrCodeUrl: qrCodeFullUrl
        });
        
        // Add Lightning invoice tags
        event.tags.push(['lightning', 'See content for full invoice']);
        event.tags.push(['l', 'Lightning payment available']);
        event.tags.push(['image', qrCodeFullUrl]);
        
        console.log('Added Lightning invoice and QR code image to Nostr post');
      } catch (err) {
        console.error('Error adding Lightning details to Nostr post:', err);
        
        // Fall back to just mentioning payment
        event.content += `\n\nScan QR code in the original High Five app to pay with Bitcoin Lightning.`;
      }
    }

    // Sign the event
    const signedEvent = finalizeEvent(event, hexKey as unknown as Uint8Array);
    
    // Log the event ID (this is what you'd use to find the event in a Nostr client)
    console.log(`Nostr event created with ID: ${signedEvent.id}`);
    console.log(`Nostr event public key: ${signedEvent.pubkey}`);
    console.log(`Nostr event tags:`, JSON.stringify(signedEvent.tags));
    
    // Log which relays we're publishing to
    console.log(`Publishing to Nostr relays: ${NOSTR_RELAYS.join(', ')}`);

    // Publish to relays
    const pubs = pool.publish(NOSTR_RELAYS, signedEvent);
    
    // Set up a more detailed success/failure tracking
    let successCount = 0;
    let failureCount = 0;
    
    // Track results from each relay
    const pubResults = pubs.map((pub, index) => 
      pub.then(() => {
        successCount++;
        console.log(`✅ Published to relay ${NOSTR_RELAYS[index]} successfully`);
        return { relay: NOSTR_RELAYS[index], success: true };
      }).catch(err => {
        failureCount++;
        console.error(`❌ Failed to publish to relay ${NOSTR_RELAYS[index]}:`, err);
        return { relay: NOSTR_RELAYS[index], success: false, error: err };
      })
    );
    
    // Wait for all publications to complete or fail
    try {
      const results = await Promise.allSettled(pubResults);
      
      // Log detailed results
      console.log(`Nostr publication complete: ${successCount} successes, ${failureCount} failures`);
      
      if (successCount > 0) {
        console.log(`High Five successfully published to Nostr with event ID: ${signedEvent.id}`);
        console.log(`Search for this event ID in Nostr clients or use https://nostr.watch/e/${signedEvent.id}`);
        return signedEvent.id; // Return the successful event ID
      } else {
        console.error(`Failed to publish High Five to any Nostr relay`);
        return null;
      }
    } catch (error) {
      console.error('Error waiting for Nostr publications:', error);
      return null;
    }
  } catch (error) {
    // Don't let Nostr errors affect the main application
    console.error('Error publishing to Nostr:', error);
    return null;
  }
}

// Format high five content including QR code image when available
function formatHighFiveContent(
  highFive: {
    recipient: string;
    reason: string;
    sender?: string;
    lightningInvoice?: string;
    qrCodeUrl?: string;
    lightningAddress?: string;
  }
): string {
  // Format sender display
  let senderPart = '';
  let isAnonymous = false;
  
  console.log(`Formatting High Five content - sender value: "${highFive.sender}"`);
  
  if (highFive.sender && highFive.sender !== 'Anonymous') {
    if (highFive.sender.startsWith('npub')) {
      // Format as a proper Nostr mention with npub
      senderPart = `${highFive.sender}`;
      
      // Add a log to track that we're adding Nostr mentions
      console.log(`Adding mention for sender: ${highFive.sender}`);
    } else {
      senderPart = highFive.sender;
    }
    console.log(`Using non-anonymous sender: "${senderPart}"`);
  } else {
    isAnonymous = true;
    console.log(`Sender is Anonymous or empty - will omit "from" part`);
  }
  
  // Format recipient display
  let recipientPart = highFive.recipient;
  if (highFive.recipient.startsWith('npub')) {
    // Format as a proper Nostr mention
    console.log(`Adding mention for recipient: ${highFive.recipient}`);
  }

  // Determine if this is a BOLT12 offer (will start with "bitcoin:?lno=")
  const isBolt12 = highFive.lightningInvoice && highFive.lightningInvoice.startsWith('bitcoin:?lno=');
  
  // Add the Bitcoin symbol (₿) before the recipient for BOLT12 offers
  const displayRecipient = isBolt12 ? `₿${recipientPart}` : recipientPart;
  
  console.log(`Creating Nostr post with recipient: ${displayRecipient} (BOLT12: ${isBolt12 ? 'Yes' : 'No'})`);
  
  // Basic content parts with modified recipient if needed
  const parts = [
    isAnonymous 
      ? `🖐️ High Five 🖐️ to ${displayRecipient}`
      : `🖐️ High Five 🖐️ to ${displayRecipient} from ${senderPart}`,
    '',
    highFive.reason
  ];
  
  if (isBolt12 && highFive.qrCodeUrl) {
    // For BOLT12 offers (from btag DNS lookup)
    parts.push('');
    parts.push('You too can send them bitcoin with your BOLT12 wallet:');
    parts.push('');
    parts.push(highFive.qrCodeUrl);
  } else if (highFive.lightningAddress) {
    // For Lightning Addresses - just include the Lightning Address text, no QR code
    parts.push('');
    parts.push(`You too can send them bitcoin to their Lightning Address: ${highFive.lightningAddress}`);
  }
  
  // No longer including the payment instruction text since we have the QR code
  
  parts.push('');
  parts.push('#highfives');

  return parts.join('\n');
}