export interface HighFiveDetails {
  recipient: string;
  reason: string;
  sender?: string;
  nostrEventId?: string;
  profileName?: string;
  senderProfileName?: string;
  recipientType?: 'btag' | 'npub' | 'lightning';
}