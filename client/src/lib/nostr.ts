import { finalizeEvent, getEventHash, getPublicKey, nip19, type NostrEvent } from 'nostr-tools';
import { HighFiveDetails } from './types';

// Interface for Nostr relay
export interface NostrRelay {
  url: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  connect: () => void;
  disconnect: () => void;
  publish: (event: NostrEvent) => Promise<void>;
}

// We will use WebSocket for direct connection to Nostr relays
class WebSocketRelay implements NostrRelay {
  url: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error' = 'disconnected';
  private socket: WebSocket | null = null;
  
  constructor(url: string) {
    this.url = url;
  }
  
  connect() {
    if (this.socket && (this.status === 'connected' || this.status === 'connecting')) return;
    
    this.status = 'connecting';
    this.socket = new WebSocket(this.url);
    
    this.socket.onopen = () => {
      this.status = 'connected';
      console.log(`Connected to Nostr relay: ${this.url}`);
    };
    
    this.socket.onclose = () => {
      this.status = 'disconnected';
      console.log(`Disconnected from Nostr relay: ${this.url}`);
    };
    
    this.socket.onerror = (error) => {
      this.status = 'error';
      console.error(`Error with Nostr relay ${this.url}:`, error);
    };
  }
  
  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.status = 'disconnected';
  }
  
  async publish(event: NostrEvent): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.status !== 'connected') {
        reject(new Error('Relay not connected'));
        return;
      }
      
      try {
        // Format for Nostr relay: ["EVENT", event]
        this.socket.send(JSON.stringify(['EVENT', event]));
        
        // Set up a temporary message handler to listen for OK response
        const messageHandler = (message: MessageEvent) => {
          try {
            const data = JSON.parse(message.data);
            if (Array.isArray(data) && data[0] === 'OK' && data[1] === event.id) {
              this.socket?.removeEventListener('message', messageHandler);
              resolve();
            }
          } catch (e) {
            // Ignore parsing errors
          }
        };
        
        // Add listener for response
        this.socket.addEventListener('message', messageHandler);
        
        // Set a timeout to resolve anyway after 3 seconds
        setTimeout(() => {
          this.socket?.removeEventListener('message', messageHandler);
          resolve(); // Resolve anyway after timeout
        }, 3000);
      } catch (error) {
        reject(error);
      }
    });
  }
}

// Main Nostr service
class NostrService {
  private relays: NostrRelay[] = [];
  private privateKey: string | null = null;
  private publicKey: string | null = null;
  
  constructor() {
    // Initialize with some well-known relays
    this.addRelay('wss://relay.damus.io');
    this.addRelay('wss://nos.lol');
    this.addRelay('wss://relay.nostr.band');
  }
  
  // Add a new relay to the list
  addRelay(url: string) {
    const relay = new WebSocketRelay(url);
    this.relays.push(relay);
    relay.connect();
    return relay;
  }
  
  // Set the private key (nsec)
  setPrivateKey(nsec: string) {
    try {
      // Convert nsec to hex if needed
      let privateKey: string;
      
      if (nsec.startsWith('nsec')) {
        try {
          const decoded = nip19.decode(nsec);
          if (decoded.type !== 'nsec') {
            throw new Error('Invalid nsec key format');
          }
          privateKey = decoded.data as string;
        } catch (e) {
          console.error('Failed to decode nsec key:', e);
          return false;
        }
      } else {
        // Assuming it's already hex
        privateKey = nsec;
      }
      
      // Try to derive the public key to validate the private key
      try {
        const derivedPublicKey = getPublicKey(privateKey);
        
        // If we got here, the key is valid
        this.privateKey = privateKey;
        this.publicKey = derivedPublicKey;
        return true;
      } catch (e) {
        console.error('Invalid private key format:', e);
        return false;
      }
    } catch (error) {
      console.error('Invalid Nostr private key:', error);
      return false;
    }
  }
  
  // Get the public key (npub format)
  getPublicKey() {
    if (!this.publicKey) return null;
    return nip19.npubEncode(this.publicKey);
  }
  
  // Create and sign a Nostr event
  createSignedEvent(content: string, kind = 1, tags: string[][] = []) {
    if (!this.privateKey || !this.publicKey) {
      throw new Error('Private key not set');
    }
    
    const event: NostrEvent = {
      kind,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content,
      pubkey: this.publicKey,
      id: '',  // Will be set by finalizeEvent
      sig: ''  // Will be set by finalizeEvent
    };
    
    // Add id and signature
    return finalizeEvent(event, this.privateKey);
  }
  
  // Publish a high five as a Nostr event
  async publishHighFive(highFive: HighFiveDetails): Promise<boolean> {
    if (!this.privateKey) {
      throw new Error('Private key not set');
    }
    
    try {
      // Format the high five as a JSON string
      const content = JSON.stringify({
        type: 'high_five',
        recipient: highFive.recipient,
        reason: highFive.reason,
        amount: highFive.amount,
        sender: highFive.sender || 'anonymous',
        timestamp: new Date().toISOString()
      });
      
      // Create tags
      const tags = [
        ['t', 'high_five'],
        ['t', 'bitcoin']
      ];
      
      // Create and sign the event (using kind 1 for standard note)
      const signedEvent = this.createSignedEvent(content, 1, tags);
      
      // Publish to all connected relays
      const publishPromises = this.relays
        .filter(relay => relay.status === 'connected')
        .map(relay => relay.publish(signedEvent));
      
      // Wait for all publish attempts to settle (even if some fail)
      const results = await Promise.allSettled(publishPromises);
      
      // Consider successful if at least one relay received the event successfully
      return results.some(result => result.status === 'fulfilled');
    } catch (error) {
      console.error('Failed to publish high five to Nostr:', error);
      return false;
    }
  }
  
  // Connect to all relays
  connectToAllRelays() {
    this.relays.forEach(relay => relay.connect());
  }
  
  // Disconnect from all relays
  disconnectFromAllRelays() {
    this.relays.forEach(relay => relay.disconnect());
  }
  
  // Get status of all relays
  getRelayStatus() {
    return this.relays.map(relay => ({
      url: relay.url,
      status: relay.status
    }));
  }
}

// Create and export a singleton instance
export const nostrService = new NostrService();

// Export a function to initialize Nostr with a private key
export const initializeNostr = (nsecKey: string): boolean => {
  return nostrService.setPrivateKey(nsecKey);
};