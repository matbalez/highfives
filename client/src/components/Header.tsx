import { useStore } from "../lib/store.tsx";

export default function Header() {
  const { bitcoinBalance } = useStore();

  return (
    <header className="sticky top-0 bg-white shadow-md z-10">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <div className="logo flex justify-center flex-grow">
          <img src="/src/assets/highfives-logo.png" alt="High Fives Logo" className="h-12" />
        </div>
        <div className="bitcoin-symbol font-futura font-bold text-primary absolute right-4">
          <span className="text-black">{bitcoinBalance.toLocaleString()}</span> bitcoins
        </div>
      </div>
    </header>
  );
}
