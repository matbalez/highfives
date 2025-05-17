// Simplified Nostr user state management
let nostrUser: string | null = null;

// Initialize from localStorage if available
if (typeof window !== 'undefined') {
  nostrUser = localStorage.getItem('connectedNpub');
}

// Check if user is connected to Nostr
export function isNostrConnected(): boolean {
  return !!nostrUser;
}

// Get the current Nostr user
export function getNostrUser(): string | null {
  return nostrUser;
}

// Set the Nostr user (connect)
export function setNostrUser(npub: string | null): void {
  nostrUser = npub;
  
  // Persist to localStorage
  if (typeof window !== 'undefined') {
    if (npub) {
      localStorage.setItem('connectedNpub', npub);
    } else {
      localStorage.removeItem('connectedNpub');
    }
  }
}

// Format npub for display (truncate middle for better UI)
export function formatNpub(npub: string): string {
  if (!npub) return "";
  return `${npub.substring(0, 8)}...${npub.substring(npub.length - 4)}`;
}