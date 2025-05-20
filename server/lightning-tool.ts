import { LightningAddress } from '@getalby/lightning-tools';
import axios from 'axios';

/**
 * Fetches payment data from a Lightning Address and generates an invoice
 * @param lightningAddress The lightning address (user@domain.com format)
 * @param amount Amount in sats to request (default: 1000)
 * @param comment Optional comment for the invoice
 * @returns The Lightning invoice payment request or null if not found
 */
export async function getInvoiceFromLightningAddress(
  lightningAddress: string, 
  amount: number = 21000, // 21,000 sats
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
    
    if (!ln.lnurlpData || !ln.lnurlpData.callback) {
      console.error('No LNURL pay data found for lightning address');
      return null;
    }
    
    // Try to create an invoice with extended expiry by calling the endpoint directly
    try {
      // Build the callback URL with parameters including extended expiry
      const callbackBase = ln.lnurlpData.callback;
      const callbackUrl = new URL(callbackBase);
      
      // Add the standard parameters
      callbackUrl.searchParams.append('amount', (amount * 1000).toString()); // Convert sats to millisats
      if (comment) {
        callbackUrl.searchParams.append('comment', comment);
      }
      
      // Add custom parameter for expiry if supported by the service
      // Many providers use different parameter names for expiry, trying common ones
      callbackUrl.searchParams.append('expiry', '259200'); // 72 hours in seconds
      callbackUrl.searchParams.append('expires', '259200'); // Alternative parameter name
      callbackUrl.searchParams.append('expirySeconds', '259200'); // Another alternative
      
      console.log(`Making direct LNURL request with extended expiry: ${callbackUrl.toString()}`);
      
      const response = await axios.get(callbackUrl.toString());
      
      if (response.data && response.data.pr) {
        console.log('Successfully generated invoice with extended expiry');
        return response.data.pr;
      } else {
        console.error('Invalid LNURL response format', response.data);
        throw new Error('Invalid LNURL response');
      }
    } catch (error) {
      console.warn('Error generating invoice with extended expiry:', error);
      console.log('Falling back to standard invoice generation');
    }
    
    // Fall back to standard invoice generation if the direct method fails
    const invoice = await ln.requestInvoice({
      satoshi: amount,
      comment: comment
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