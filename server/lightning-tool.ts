import { LightningAddress } from '@getalby/lightning-tools';

/**
 * Fetches payment data from a Lightning Address and generates an invoice
 * @param lightningAddress The lightning address (user@domain.com format)
 * @param amount Amount in sats to request (default: 1000)
 * @param comment Optional comment for the invoice
 * @returns The Lightning invoice payment request or null if not found
 */
export async function getInvoiceFromLightningAddress(
  lightningAddress: string, 
  amount: number = 21000, // Changed to 21,000 sats
  comment: string = 'High Five Payment'
): Promise<string | null> {
  try {
    if (!lightningAddress.includes('@')) {
      console.error('Invalid lightning address format. Expected user@domain format');
      return null;
    }

    console.log(`Generating invoice for lightning address: ${lightningAddress}`);
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
    
    // Generate an invoice
    const invoice = await ln.requestInvoice({
      satoshi: amount,
      comment: comment,
    });
    
    if (!invoice || !invoice.paymentRequest) {
      console.error('Failed to generate invoice');
      return null;
    }
    
    // Log the full payment request for debugging
    console.log(`Payment request for ${amount} sats to ${lightningAddress}:`);
    console.log(invoice.paymentRequest);
    
    console.log(`Successfully generated invoice for ${lightningAddress}`);
    return invoice.paymentRequest;
  } catch (error) {
    console.error('Error generating invoice from Lightning Address:', error);
    return null;
  }
}

/**
 * Fetches LNURL callback URL from a Lightning Address
 * @param lightningAddress The lightning address (user@domain.com format)
 * @returns The LNURL callback URL or null if not found
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
    
    // Get the callback URL
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