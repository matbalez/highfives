import { nip19, SimplePool, type Event } from 'nostr-tools';

// Demo code to test Nostr connectivity with more direct approach
export async function testNostrProfileLookup(npub: string): Promise<any> {
  try {
    console.log(`Testing direct Nostr lookup for ${npub}`);
    
    // Decode the npub
    let pubkey: string;
    try {
      const decoded = nip19.decode(npub);
      if (decoded.type !== 'npub') {
        console.error('Invalid npub format');
        return { success: false, error: 'Invalid npub format' };
      }
      pubkey = decoded.data as string;
      console.log(`Decoded pubkey: ${pubkey}`);
    } catch (e) {
      console.error('Error decoding npub:', e);
      return { success: false, error: 'Failed to decode npub' };
    }
    
    // Set up relays
    const relays = [
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.nostr.band',
      'wss://relay.snort.social',
      'wss://relay.current.fyi'
    ];
    
    // Create a new pool
    const pool = new SimplePool();
    
    // Try getting events with a Promise and timeout
    const timeoutMs = 8000;
    const timeoutPromise = new Promise(resolve => 
      setTimeout(() => resolve({ success: false, error: 'Timeout' }), timeoutMs)
    );
    
    const fetchPromise = new Promise(async (resolve) => {
      try {
        // Use basic fetch methods
        const events = await pool.list(relays, [
          {
            kinds: [0],
            authors: [pubkey],
            limit: 1
          }
        ]);
        
        if (events && events.length > 0) {
          console.log('Found profile events:', events);
          try {
            const content = JSON.parse(events[0].content);
            console.log('Profile content:', content);
            
            if (content.lud16) {
              resolve({ 
                success: true, 
                lightningAddress: content.lud16,
                profileData: content 
              });
            } else {
              resolve({ 
                success: false, 
                error: 'No Lightning Address found',
                profileData: content 
              });
            }
          } catch (parseError) {
            console.error('Error parsing profile content:', parseError);
            resolve({ success: false, error: 'Failed to parse profile data' });
          }
        } else {
          console.log('No profile events found');
          resolve({ success: false, error: 'No profile events found' });
        }
      } catch (error) {
        console.error('Error in direct fetch:', error);
        resolve({ success: false, error: String(error) });
      } finally {
        pool.close(relays);
      }
    });
    
    // Race the fetch against the timeout
    return Promise.race([fetchPromise, timeoutPromise]);
  } catch (error) {
    console.error('Error in testNostrProfileLookup:', error);
    return { success: false, error: String(error) };
  }
}