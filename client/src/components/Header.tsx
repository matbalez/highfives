import highFivesLogo from "../assets/hf square.png";
import { Button } from "@/components/ui/button";

export default function Header() {
  return (
    <header className="sticky top-0 bg-white shadow-md z-10">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <div className="logo">
          <img src={highFivesLogo} alt="High Fives Logo" className="h-12" />
        </div>
        <Button 
          variant="outline" 
          className="font-futura font-bold text-black bg-white border-2 border-primary hover:bg-white/90"
        >
          Sign In
        </Button>
      </div>
    </header>
  );
}
