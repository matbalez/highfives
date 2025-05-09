import { useState } from "react";
import highFivesLogo from "../assets/hf square.png";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import NostrSetupDialog from "./NostrSetupDialog";

export default function Header() {
  const [nostrDialogOpen, setNostrDialogOpen] = useState(false);
  const { nostrConfigured } = useStore();

  const handleSignInClick = () => {
    setNostrDialogOpen(true);
  };

  return (
    <header className="sticky top-0 bg-white shadow-md z-10">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <div className="logo">
          <img src={highFivesLogo} alt="High Fives Logo" className="h-12" />
        </div>
        <Button 
          variant="outline" 
          className="font-futura font-bold text-black bg-white border-2 border-primary hover:bg-white/90"
          onClick={handleSignInClick}
        >
          {nostrConfigured ? "Nostr Connected" : "Sign In"}
        </Button>
      </div>

      <NostrSetupDialog 
        open={nostrDialogOpen} 
        onOpenChange={setNostrDialogOpen} 
      />
    </header>
  );
}
