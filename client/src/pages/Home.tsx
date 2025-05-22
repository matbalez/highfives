import { useState } from "react";
import HighFiveForm from "@/components/HighFiveForm";
import HighFivesList from "@/components/HighFivesList";
import Notification from "@/components/Notification";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import bitcoinHighFiveImage from "../assets/bitcoin-high-five.png";

export default function Home() {
  // Check if there's a saved tab preference in sessionStorage
  const savedTab = typeof window !== 'undefined' ? window.sessionStorage.getItem("activeTab") : null;
  const [activeTab, setActiveTab] = useState(savedTab || "send");
  
  // Clear the session storage after reading it to avoid persistence issues
  if (typeof window !== 'undefined' && savedTab) {
    window.sessionStorage.removeItem("activeTab");
  }

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
            
            {/* Attractive suggestion text box */}
            <div className="mt-6 mb-6 bg-gradient-to-r from-amber-100 to-yellow-100 border border-amber-200 rounded-lg p-4 text-center shadow-sm">
              <p className="text-amber-800 font-medium">
                You can send any amount, but <span className="font-bold">₿21K</span> has a nice ring to it
              </p>
            </div>
            
            <div className="mt-8 flex justify-center">
              <img 
                src={bitcoinHighFiveImage} 
                alt="Bitcoin High Five" 
                className="w-64 h-64 object-contain"
              />
            </div>
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
