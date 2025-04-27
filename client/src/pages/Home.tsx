import HighFiveForm from "@/components/HighFiveForm";
import Notification from "@/components/Notification";
import logoSvg from "../assets/logo.svg";

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-6 max-w-md flex-1">
      {/* Logo */}
      <div className="flex justify-center mb-8">
        <img src={logoSvg} alt="High Fives Logo" className="h-24" />
      </div>

      {/* Form Section */}
      <div className="mb-8">
        <h1 className="text-2xl font-futura font-bold text-center mb-6">Send a High Five</h1>
        <HighFiveForm />
      </div>

      {/* Promotion */}
      <div className="bg-secondary p-4 rounded-lg text-center">
        <p className="font-futura">
          Every day we will pick the best High Five we've seen and make it a High Ten—by doubling the amount.
        </p>
      </div>

      {/* Notification Component */}
      <Notification />
    </main>
  );
}
