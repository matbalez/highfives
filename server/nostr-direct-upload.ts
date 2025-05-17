import { type Event, finalizeEvent, getPublicKey, nip19 } from 'nostr-tools';
import * as QRCode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Generate a QR code and return it as a buffer
export async function generateQRCodeBuffer(data: string): Promise<Buffer> {
  // Create a temporary directory if it doesn't exist
  const tmpDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  
  // Generate a temporary filename
  const filename = path.join(tmpDir, `${crypto.randomUUID()}.png`);
  
  // Generate the QR code as a PNG file
  await QRCode.toFile(filename, data, {
    type: 'png',
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 512,
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  });
  
  console.log(`Generated QR code image: ${filename}`);
  
  // Read the file into a buffer
  const buffer = fs.readFileSync(filename);
  
  // Clean up the temporary file
  fs.unlinkSync(filename);
  
  return buffer;
}

// Create a NIP-94 image event directly in the Nostr post
export async function createQRCodeImageEvent(
  lightningInvoice: string, 
  privateKeyHex: string
): Promise<string> {
  try {
    // Handle nsec format if needed
    let hexKey = privateKeyHex;
    if (typeof privateKeyHex === 'string' && privateKeyHex.startsWith('nsec')) {
      try {
        const { data } = nip19.decode(privateKeyHex);
        hexKey = data as string;
      } catch (e) {
        console.error('Invalid nsec key:', e);
        throw e;
      }
    }

    // Get public key from private key
    const publicKey = getPublicKey(hexKey as unknown as Uint8Array);
    
    // Generate QR code as buffer
    const qrCodeBuffer = await generateQRCodeBuffer(lightningInvoice);
    
    // Convert buffer to base64
    const base64Content = qrCodeBuffer.toString('base64');
    console.log(`Generated base64 QR code, size: ${base64Content.length} chars`);
    
    // Create a kind 1063 event (file attachment)
    const imageEvent: Event = {
      kind: 1063, // File attachment kind (NIP-94)
      pubkey: publicKey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['alt', 'QR Code for Lightning payment'],
        ['m', 'image/png'],
        ['ox', 'image'],
        ['size', String(qrCodeBuffer.length)]
      ],
      content: base64Content,
      id: '',
      sig: '',
    };
    
    // Sign the event
    const signedEvent = finalizeEvent(imageEvent, hexKey as unknown as Uint8Array);
    
    // Return the event ID which can be referenced in the main post
    return signedEvent.id;
  } catch (error) {
    console.error('Error creating QR code image event:', error);
    throw error;
  }
}