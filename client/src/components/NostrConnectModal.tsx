import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";

interface NostrConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected: (npub: string) => void;
}

enum ConnectStep {
  ENTER_NPUB,
  ENTER_PIN,
}

export default function NostrConnectModal({
  isOpen,
  onClose,
  onConnected,
}: NostrConnectModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<ConnectStep>(ConnectStep.ENTER_NPUB);
  const [npub, setNpub] = useState("");
  const [pin, setPin] = useState("");
  const [expectedPin, setExpectedPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(ConnectStep.ENTER_NPUB);
      setNpub("");
      setPin("");
      setError(null);
    }
  }, [isOpen]);

  const handleNpubSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!npub) {
      setError("Please enter your Nostr public key (npub)");
      return;
    }
    
    // Basic validation for npub format
    if (!npub.startsWith("npub1")) {
      setError("Invalid npub format. Nostr public keys start with npub1");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Send request to backend to generate PIN and send DM
      const response = await axios.post("/api/nostr/send-verification", { npub });
      
      // Server returns the PIN for verification (in a real app, this would only be stored on server)
      setExpectedPin(response.data.pin);
      
      // Move to PIN entry step
      setStep(ConnectStep.ENTER_PIN);
      
      toast({
        title: "Verification PIN Sent",
        description: "Check your Nostr client for a DM containing your verification PIN",
      });
    } catch (err: any) {
      console.error("Error sending verification PIN:", err);
      setError(err.response?.data?.message || "Failed to send verification PIN. Please try again.");
      
      toast({
        title: "Verification Failed",
        description: "Could not send verification PIN to your Nostr account",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pin) {
      setError("Please enter the PIN sent to your Nostr account");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Verify PIN client-side (in a real app, verification would be done on server)
      if (pin === expectedPin) {
        // Save npub to local storage for persistence
        localStorage.setItem("connectedNpub", npub);
        
        toast({
          title: "Successfully Connected",
          description: "Your Nostr account has been connected",
        });
        
        // Notify parent component about successful connection
        onConnected(npub);
        
        // Close modal
        onClose();
      } else {
        setError("Incorrect PIN. Please check the PIN sent to your Nostr account.");
        
        toast({
          title: "Verification Failed",
          description: "The PIN you entered is incorrect",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Error verifying PIN:", err);
      setError("Failed to verify PIN. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>
          {step === ConnectStep.ENTER_NPUB ? "Connect with Nostr" : "Enter Verification PIN"}
        </DialogTitle>
        <DialogDescription>
          {step === ConnectStep.ENTER_NPUB 
            ? "Enter your Nostr public key (npub) to connect your account" 
            : "Enter the 4-digit PIN sent to your Nostr account"}
        </DialogDescription>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md text-sm">
            {error}
          </div>
        )}
        
        {step === ConnectStep.ENTER_NPUB ? (
          <form onSubmit={handleNpubSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                placeholder="npub1..."
                value={npub}
                onChange={(e) => setNpub(e.target.value)}
                className="w-full"
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500">
                Your Nostr public key (npub) can be found in your Nostr client settings
              </p>
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Sending..." : "Continue"}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                placeholder="4-digit PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full text-center text-2xl letter-spacing-wide"
                maxLength={4}
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500">
                Check your Nostr client for a direct message from High Fives containing your PIN
              </p>
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Verifying..." : "Verify PIN"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}