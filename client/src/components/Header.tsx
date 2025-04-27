import { useStore } from "../lib/store.tsx";
import highFivesLogo from "../assets/hf square.png";

export default function Header() {
  const { bitcoinBalance } = useStore();

  return (
    <header className="sticky top-0 bg-white shadow-md z-10">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <div className="logo">
          <img src={highFivesLogo} alt="High Fives Logo" className="h-12" />
        </div>
        <div className="bitcoin-symbol font-futura font-bold text-black">
          {bitcoinBalance.toLocaleString()} <span className="text-primary">₿</span>
        </div>
      </div>
    </header>
  );
}
