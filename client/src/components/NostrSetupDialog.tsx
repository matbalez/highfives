import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";

interface NostrSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function NostrSetupDialog({ open, onOpenChange }: NostrSetupDialogProps) {
  const [nsecKey, setNsecKey] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { configureNostr } = useStore();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nsecKey.trim()) {
      toast({
        title: "Error",
        description: "Please enter your Nostr private key (nsec)",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const success = configureNostr(nsecKey);
      if (success) {
        toast({
          title: "Success",
          description: "Nostr integration configured successfully!",
        });
        onOpenChange(false);
      } else {
        toast({
          title: "Error",
          description: "Invalid Nostr private key. Please check and try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error configuring Nostr:", error);
      toast({
        title: "Error",
        description: "Failed to configure Nostr integration. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    // Clear the input when dialog is closed
    if (!newOpen) {
      setNsecKey("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set up Nostr Integration</DialogTitle>
          <DialogDescription>
            Enter your Nostr private key (nsec) to enable publishing high fives to the Nostr network.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="nsec">Nostr Private Key (nsec)</Label>
              <Input
                id="nsec"
                type="password"
                placeholder="nsec1..."
                value={nsecKey}
                onChange={(e) => setNsecKey(e.target.value)}
                className="col-span-3"
              />
              <p className="text-sm text-gray-500">
                Your private key is stored securely in your browser and is never sent to our servers.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Configuring..." : "Configure Nostr"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}