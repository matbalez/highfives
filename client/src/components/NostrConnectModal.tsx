import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { nip19 } from "nostr-tools";
import { InputOTP, InputOTPGroup } from "@/components/ui/input-otp";
import { CheckCircle, AlertCircle } from "lucide-react";

type NostrConnectStep = 'npub' | 'pin' | 'success' | 'error';

interface NostrConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Custom InputOTPSlot component
const InputOTPSlot = ({ char, hasFakeCaret, isActive, className }: { 
  char: string | null;
  hasFakeCaret: boolean;
  isActive: boolean;
  className?: string;
}) => {
  return (
    <div
      className={`relative flex h-10 w-10 items-center justify-center border-y border-r border-input text-sm transition-all first:rounded-l-md first:border-l last:rounded-r-md ${
        isActive ? 'z-10 ring-2 ring-ring ring-offset-background' : ''
      } ${className || ''}`}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
        </div>
      )}
    </div>
  );
};

export default function NostrConnectModal({ isOpen, onClose }: NostrConnectModalProps) {
  const store = useStore();
  const [step, setStep] = useState<NostrConnectStep>('npub');
  const [npub, setNpub] = useState<string>('');
  const [pubkey, setPubkey] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [generatedPin, setGeneratedPin] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('npub');
      setNpub('');
      setPubkey('');
      setPin('');
      setGeneratedPin('');
      setError(null);
    }
  }, [isOpen]);

  // Function to generate a random 4-digit PIN
  const generatePin = () => {
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedPin(pin);
    return pin;
  };

  // Function to send a DM to a Nostr pubkey with a PIN
  const sendNostrDM = async (recipientPubkey: string, pin: string) => {
    try {
      // Get the server's private key
      // In a real app, this would be securely managed on the server side
      const response = await fetch('/api/send-nostr-dm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientPubkey,
          message: `Your High Fives verification PIN is: ${pin}`
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send Nostr DM');
      }

      return true;
    } catch (err) {
      console.error('Error sending Nostr DM:', err);
      return false;
    }
  };

  // Handle NIP-19 npub submission
  const handleNpubSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      // Validate the npub format
      if (!npub.startsWith('npub1')) {
        throw new Error('Invalid npub format. It should start with "npub1"');
      }

      // Decode the npub to get the pubkey
      const decoded = nip19.decode(npub);
      if (decoded.type !== 'npub') {
        throw new Error('Invalid npub format');
      }

      const decodedPubkey = decoded.data as string;
      setPubkey(decodedPubkey);

      // Generate a PIN and send it as a DM
      const pin = generatePin();
      const dmSent = await sendNostrDM(decodedPubkey, pin);

      if (dmSent) {
        setStep('pin');
      } else {
        throw new Error('Failed to send verification PIN. Please try again.');
      }
    } catch (err) {
      console.error('Error in npub handling:', err);
      setError((err as Error).message || 'Failed to connect with Nostr');
    } finally {
      setLoading(false);
    }
  };

  // Handle PIN verification
  const handlePinVerify = () => {
    if (pin === generatedPin) {
      // PIN matches, set the user as connected
      if (setUserNpub) {
        setUserNpub(npub);
      }
      setStep('success');
    } else {
      setError('Incorrect PIN. Please try again.');
    }
  };

  // Close the modal with final state
  const handleFinalClose = () => {
    if (step === 'success') {
      onClose();
    } else {
      // If user wants to cancel the process
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-bold mb-2">
            {step === 'npub' && "Connect with Nostr"}
            {step === 'pin' && "Enter Verification PIN"}
            {step === 'success' && "Successfully Connected"}
            {step === 'error' && "Connection Error"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {step === 'npub' && "Enter your Nostr npub to connect"}
            {step === 'pin' && "Check your Nostr client for a DM with a 4-digit PIN"}
            {step === 'success' && "Your Nostr account is now connected"}
            {step === 'error' && "There was a problem connecting to your Nostr account"}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md flex items-center gap-2 mb-4">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
          </div>
        )}

        {step === 'npub' && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="npub">Your Nostr Public Key (npub)</Label>
              <Input
                id="npub"
                placeholder="npub1..."
                value={npub}
                onChange={(e) => setNpub(e.target.value)}
              />
            </div>
            <Button 
              onClick={handleNpubSubmit} 
              className="w-full" 
              disabled={loading || !npub.startsWith('npub1')}
            >
              {loading ? "Sending Verification..." : "Connect"}
            </Button>
          </div>
        )}

        {step === 'pin' && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="pin">Enter the 4-digit PIN sent to your Nostr client</Label>
              <div className="flex justify-center py-4">
                <InputOTP 
                  maxLength={4} 
                  value={pin} 
                  onChange={setPin}
                  render={({ slots }) => (
                    <InputOTPGroup>
                      {slots.map((slot, index) => (
                        <InputOTPSlot key={index} {...slot} />
                      ))}
                    </InputOTPGroup>
                  )}
                />
              </div>
            </div>
            <Button 
              onClick={handlePinVerify} 
              className="w-full" 
              disabled={pin.length !== 4}
            >
              Verify PIN
            </Button>
          </div>
        )}

        {step === 'success' && (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center justify-center py-4">
              <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
              <p className="text-center">Your Nostr key is now connected to High Fives!</p>
            </div>
            <Button 
              onClick={handleFinalClose} 
              className="w-full bg-green-500 hover:bg-green-600"
            >
              Continue
            </Button>
          </div>
        )}

        {step === 'error' && (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center justify-center py-4">
              <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
              <p className="text-center">{error || "There was an error connecting your Nostr account"}</p>
            </div>
            <Button 
              onClick={() => setStep('npub')} 
              className="w-full"
            >
              Try Again
            </Button>
          </div>
        )}

        <DialogFooter className="flex flex-col gap-2 sm:gap-0">
          {step !== 'success' && step !== 'error' && (
            <Button 
              variant="outline" 
              onClick={onClose}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}