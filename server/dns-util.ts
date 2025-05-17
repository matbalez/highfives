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

    // Set a timeout for DNS resolution
    const dnsPromise = resolveTxt(dnsRecord);
    
    // Create a timeout promise that rejects after 5 seconds
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('DNS lookup timed out after 5 seconds')), 5000);
    });
    
    // Race the DNS resolution against the timeout
    const txtRecords = await Promise.race([dnsPromise, timeoutPromise]) as string[][];
    
    // BIP-353 payment instructions are stored in a single TXT record
    if (txtRecords && txtRecords.length > 0) {
      // TXT records are arrays of strings, join them together
      const record = txtRecords[0].join('');
      
      // Per BIP-353, payment instructions should start with lno...
      if (record.startsWith('lno')) {
        console.log('Found valid payment instruction (direct format)');
        return record;
      } 
      // Check for bitcoin URI format (bitcoin:?lno=...)
      else if (record.includes('lno=')) {
        console.log('Found payment instruction in bitcoin URI format');
        // Extract the lno parameter
        const match = record.match(/lno=([^&]+)/);
        if (match && match[1]) {
          console.log('Extracted LNO payment instruction from URI');
          return match[1];
        }
      }
      
      console.log('Found TXT record but could not extract a valid payment instruction');
      console.log('Record content:', record);
    }
    
    console.log('No payment instructions found');
    return null;
  } catch (error) {
    console.error('Error looking up payment instructions:', error);
    
    // Check for specific error types and provide more detailed logging
    if (error instanceof Error) {
      if (error.message.includes('ENOTFOUND') || error.message.includes('SERVFAIL')) {
        console.error('DNS server could not be reached or domain does not exist');
      } else if (error.message.includes('timed out')) {
        console.error('DNS lookup timed out - services might be temporarily unavailable');
      }
    }
    
    // In a real production environment, we would implement retry logic here
    return null;
  }
}