import { LightningAddress } from '@getalby/lightning-tools';

/**
 * Fetches payment data from a Lightning Address
 * @param lightningAddress The lightning address (user@domain.com format)
 * @returns The LNURL-pay string data or null if not found
 */
export async function getLnurlFromLightningAddress(lightningAddress: string): Promise<string | null> {
  try {
    if (!lightningAddress.includes('@')) {
      console.error('Invalid lightning address format. Expected user@domain format');
      return null;
    }

    console.log(`Fetching LNURL data for lightning address: ${lightningAddress}`);
    const ln = new LightningAddress(lightningAddress);
    
    // Fetch the LNURL data with timeout
    const fetchPromise = ln.fetch();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Lightning fetch timed out after 10 seconds')), 10000);
    });
    
    await Promise.race([fetchPromise, timeoutPromise]);
    
    if (!ln.lnurlpData) {
      console.error('No LNURL pay data found for lightning address');
      return null;
    }
    
    // Convert to LNURL string format
    const lnurlEncoded = ln.lnurlpData.callback;
    if (!lnurlEncoded) {
      console.error('No callback URL in LNURL data');
      return null;
    }
    
    return lnurlEncoded;
  } catch (error) {
    console.error('Error getting LNURL from Lightning Address:', error);
    return null;
  }
}