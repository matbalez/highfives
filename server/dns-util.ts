import * as dns from 'dns';
import { promisify } from 'util';

const resolveTxt = promisify(dns.resolveTxt);

/**
 * Look up payment instructions for a Bitcoin BIP-353 btag
 * Format: user.user._bitcoin-payment.domain
 */
export async function lookupPaymentInstructions(btag: string): Promise<string | null> {
  try {
    // Extract user and domain from the btag
    // Expected format is something like "user@domain.com" where we need user.user._bitcoin-payment.domain
    if (!btag.includes('@')) {
      console.error('Invalid btag format. Expected user@domain format');
      return null;
    }

    const [user, domain] = btag.split('@');
    if (!user || !domain) {
      console.error('Invalid btag format. Could not extract user or domain.');
      return null;
    }

    // Construct DNS query according to BIP-353
    const dnsRecord = `${user}.user._bitcoin-payment.${domain}`;
    console.log(`Looking up TXT record for: ${dnsRecord}`);

    // Query TXT record
    const txtRecords = await resolveTxt(dnsRecord);
    
    // BIP-353 payment instructions are stored in a single TXT record
    if (txtRecords && txtRecords.length > 0) {
      // TXT records are arrays of strings, join them together
      const record = txtRecords[0].join('');
      
      // Per BIP-353, payment instructions should start with lno...
      if (record.startsWith('lno')) {
        console.log('Found valid payment instruction');
        return record;
      } else {
        console.log('Found TXT record but it does not contain a valid payment instruction');
        console.log('Record content:', record);
      }
    }
    
    console.log('No payment instructions found');
    return null;
  } catch (error) {
    console.error('Error looking up payment instructions:', error);
    return null;
  }
}