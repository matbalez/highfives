import { useState } from "react";
import HighFiveForm from "@/components/HighFiveForm";
import HighFivesList from "@/components/HighFivesList";
import Notification from "@/components/Notification";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Home() {
  const [activeTab, setActiveTab] = useState("send");

  return (
    <main className="container mx-auto px-4 py-6 max-w-3xl flex-1">
      <Tabs defaultValue="send" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="send" className="font-futura font-bold">Send High Five</TabsTrigger>
          <TabsTrigger value="list" className="font-futura font-bold">All High Fives</TabsTrigger>
        </TabsList>
        
        <TabsContent value="send" className="space-y-6">
          {/* Form Section */}
          <div className="mb-8 max-w-md mx-auto">
            <HighFiveForm />
          </div>

          {/* Promotion */}
          <div className="bg-secondary p-4 rounded-lg text-center max-w-md mx-auto">
            <p className="font-futura">
              Every day we will pick the best High Five we've seen and make it a High Ten—by doubling the amount.
            </p>
          </div>
        </TabsContent>
        
        <TabsContent value="list">
          <div className="mb-6">
            <HighFivesList />
          </div>
        </TabsContent>
      </Tabs>

      {/* Notification Component */}
      <Notification />
    </main>
  );
}
