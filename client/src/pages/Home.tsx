import HighFiveForm from "@/components/HighFiveForm";
import Notification from "@/components/Notification";

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-6 max-w-md flex-1">
      {/* Form Section */}
      <div className="mb-8">
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
