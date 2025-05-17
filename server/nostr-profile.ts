import { nip19, SimplePool, type Event } from 'nostr-tools';
import { setupNostrPool } from './nostr-util';

// Relays to query for profile information
const PROFILE_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.snort.social',
  'wss://relay.current.fyi'
];

/**
 * Get a Lightning Address from a Nostr npub
 * @param npub The npub to look up
 * @returns The Lightning Address if found, or null
 */
export async function getLightningAddressFromNpub(npub: string): Promise<string | null> {
  try {
    // Decode the npub to get the hex public key
    let pubkey: string;
    try {
      const decoded = nip19.decode(npub);
      if (decoded.type !== 'npub') {
        console.error('Invalid npub format');
        return null;
      }
      pubkey = decoded.data as string;
    } catch (e) {
      console.error('Error decoding npub:', e);
      return null;
    }

    // Set up Nostr pool
    const pool = setupNostrPool(PROFILE_RELAYS);

    // Look up the profile metadata (kind 0) events
    console.log(`Looking up profile metadata for pubkey: ${pubkey}`);
    const profileEvents = await getProfileEvents(pool, pubkey);

    if (!profileEvents.length) {
      console.log('No profile metadata found');
      pool.close(PROFILE_RELAYS);
      return null;
    }

    // Sort by created_at to get the most recent event
    profileEvents.sort((a, b) => b.created_at - a.created_at);
    const latestProfile = profileEvents[0];

    // Extract lightning address from profile metadata
    const lightningAddress = extractLightningAddress(latestProfile);
    console.log(`Lightning address extracted: ${lightningAddress}`);

    // Clean up pool
    pool.close(PROFILE_RELAYS);
    
    return lightningAddress;
  } catch (error) {
    console.error('Error getting Lightning Address from npub:', error);
    return null;
  }
}

/**
 * Get profile events (kind 0) for a given pubkey
 */
async function getProfileEvents(pool: SimplePool, pubkey: string): Promise<Event[]> {
  // SimplePool has different methods across versions - let's use a promise based approach
  // that works with many versions of nostr-tools
  return new Promise((resolve) => {
    const events: Event[] = [];
    
    // Create a timeout to ensure we don't wait forever
    const timeout = setTimeout(() => {
      console.log('Timeout reached while fetching profile events');
      resolve(events);
    }, 6000);
    
    try {
      // Use the latest method signatures
      let subscription;
      
      try {
        // Try using subscribeMany (newer versions)
        subscription = pool.subscribeMany(
          PROFILE_RELAYS,
          [{ kinds: [0], authors: [pubkey] }],
          {
            // Event handler
            onevent: (event: Event) => {
              events.push(event);
            },
            // End of stored events handler
            oneose: () => {
              clearTimeout(timeout);
              if (subscription && typeof subscription.close === 'function') {
                subscription.close();
              }
              resolve(events);
            }
          }
        );
      } catch (err) {
        console.log('Error with subscribeMany, falling back to alternate method');
        
        // Fallback for compatibility with different versions
        try {
          // Try using the sub method (older versions)
          const sub = pool.sub(PROFILE_RELAYS, [{ kinds: [0], authors: [pubkey] }]);
          
          sub.on('event', (event: Event) => {
            events.push(event);
          });
          
          sub.on('eose', () => {
            clearTimeout(timeout);
            sub.unsub();
            resolve(events);
          });
        } catch (subErr) {
          console.error('Error with sub method as well:', subErr);
          clearTimeout(timeout);
          resolve(events);
        }
      }
    } catch (error) {
      console.error('Error setting up profile event subscription:', error);
      clearTimeout(timeout);
      resolve(events);
    }
  });
}

/**
 * Extract Lightning Address from a Nostr profile metadata event
 */
function extractLightningAddress(event: Event): string | null {
  try {
    // Parse the content as JSON
    const content = JSON.parse(event.content);
    
    // Look for Lightning Address in lud16 field
    if (content.lud16) {
      return content.lud16;
    }
    
    // Alternative field name sometimes used
    if (content.lightning_address) {
      return content.lightning_address;
    }
    
    // No Lightning Address found
    return null;
  } catch (error) {
    console.error('Error parsing profile content:', error);
    return null;
  }
}

/**
 * Extract profile information from a Nostr metadata event
 * @param event The Nostr event (kind 0) to extract profile info from
 * @returns Object containing profile name and other metadata
 */
export function extractProfileInfo(event: Event): { name?: string, displayName?: string } {
  try {
    // Parse the content as JSON
    const content = JSON.parse(event.content);
    
    return {
      name: content.name || undefined,
      displayName: content.display_name || content.displayName || undefined
    };
  } catch (error) {
    console.error('Error parsing profile content:', error);
    return {};
  }
}

/**
 * Get profile name from a Nostr npub using profile events
 * @param npub The npub to look up
 * @returns The profile name if found, or null
 */
export async function getProfileNameFromNpub(npub: string): Promise<string | null> {
  try {
    // Decode the npub to get the hex public key
    let pubkey: string;
    try {
      const decoded = nip19.decode(npub);
      if (decoded.type !== 'npub') {
        console.error('Invalid npub format');
        return null;
      }
      pubkey = decoded.data as string;
    } catch (e) {
      console.error('Error decoding npub:', e);
      return null;
    }

    // Set up Nostr pool
    const pool = setupNostrPool(PROFILE_RELAYS);

    // Look up the profile metadata (kind 0) events
    console.log(`Looking up profile metadata for pubkey: ${pubkey}`);
    const profileEvents = await getProfileEvents(pool, pubkey);

    if (!profileEvents.length) {
      console.log('No profile metadata found');
      pool.close(PROFILE_RELAYS);
      return null;
    }

    // Sort by created_at to get the most recent event
    profileEvents.sort((a, b) => b.created_at - a.created_at);
    const latestProfile = profileEvents[0];

    // Extract profile info from metadata
    const profileInfo = extractProfileInfo(latestProfile);
    const profileName = profileInfo.displayName || profileInfo.name;
    console.log(`Profile name extracted: ${profileName || 'No name found'}`);

    // Clean up pool
    pool.close(PROFILE_RELAYS);
    
    return profileName || null;
  } catch (error) {
    console.error('Error getting profile name from npub:', error);
    return null;
  }
}