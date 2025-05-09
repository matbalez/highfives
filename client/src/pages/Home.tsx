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
        <TabsList className="flex justify-center w-full mb-6 bg-transparent p-0 gap-8">
          <TabsTrigger value="send" className="font-futura text-lg bg-transparent link-tab">Send</TabsTrigger>
          <TabsTrigger value="list" className="font-futura text-lg bg-transparent link-tab">See all</TabsTrigger>
        </TabsList>
        
        <TabsContent value="send" className="space-y-6">
          {/* Form Section */}
          <div className="mb-8 max-w-md mx-auto">
            <HighFiveForm />
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
