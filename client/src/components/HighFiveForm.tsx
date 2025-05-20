import { useForm } from "react-hook-form";
import axios from "axios";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "../lib/store.tsx";
import { useToast } from "@/hooks/use-toast";
import { HighFiveDetails } from "../lib/types";
import SuccessScreen from "./SuccessScreen";
import PaymentModal from "./PaymentModal";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const formSchema = z.object({
  recipient: z.string().min(1, {
    message: "Recipient is required",
  }),
  reason: z.string().min(1, {
    message: "Please explain what you're giving the High Five for",
  }),
  sender: z.string().optional(),
});

export default function HighFiveForm() {
  const { bitcoinBalance, setBitcoinBalance, nostrUser } = useStore();
  const { toast } = useToast();
  const [successDetails, setSuccessDetails] = useState<HighFiveDetails | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [pendingHighFive, setPendingHighFive] = useState<HighFiveDetails | null>(null);
  // State to track input mode ('btag' or 'npub')
  const [inputMode, setInputMode] = useState<'btag' | 'npub'>('btag');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      recipient: "",
      reason: "",
      sender: nostrUser || "",
    },
  });
  
  // Update sender field when nostrUser changes (either connected or disconnected)
  useEffect(() => {
    if (nostrUser) {
      // Set the sender field with the nostrUser value when connected
      form.setValue("sender", nostrUser);
    } else {
      // Clear the sender field when disconnected
      form.setValue("sender", "");
    }
  }, [nostrUser, form]);

  // Clear the recipient field when switching between modes
  useEffect(() => {
    form.setValue("recipient", "");
  }, [inputMode, form]);

  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);

  async function handleFormSubmit(values: z.infer<typeof formSchema>) {
    // Append two line breaks and high five emojis to the reason
    const enhancedReason = `${values.reason}\n\n✋✋✋`;
    
    // Show loading state while we verify payment instructions
    setIsVerifyingPayment(true);
    
    try {
      let response;
      const recipient = values.recipient;
      
      // Each address type should use its specified endpoint
      if (inputMode === 'npub') {
        // For npub, look up payment instructions via npub endpoint
        response = await axios.get(`/api/payment-instructions?npub=${encodeURIComponent(recipient)}`);
      } else {
        // For btag/lightning, use a combined endpoint that will try both methods
        response = await axios.get(`/api/combined-payment-instructions?address=${encodeURIComponent(recipient)}`);
      }
      
      if (response.data && response.data.paymentInstructions) {
        // Create and post the High Five to Nostr immediately
        const lightningInvoice = response.data.paymentInstructions;
        
        // Send to API with lightning invoice and get the response including Nostr event ID
        const result = await apiRequest(
          'POST',
          '/api/high-fives', 
          {
            recipient: values.recipient,
            reason: enhancedReason,
            sender: values.sender || undefined,
            profileName: response.data.profileName, // Include profile name if available
            lightningInvoice: lightningInvoice, // Pass lightning invoice separately
            recipientType: inputMode // Indicate the type of recipient
          }
        );
        
        // Invalidate the high fives query cache
        queryClient.invalidateQueries({ queryKey: ['/api/high-fives'] });
        
        // Store the high five details with Nostr event ID for later use
        setPendingHighFive({
          recipient: values.recipient,
          reason: enhancedReason,
          sender: values.sender || undefined,
          profileName: response.data.profileName,
          nostrEventId: result.nostrEventId,
          senderProfileName: result.senderProfileName,
          recipientType: inputMode // Include the recipient type
        });
        
        // Open payment modal
        setPaymentModalOpen(true);
      } else {
        // This shouldn't happen based on API design but handling just in case
        throw new Error("Invalid payment instructions");
      }
    } catch (error: any) {
      console.error("Error fetching payment instructions:", error);
      
      // Check if it's a network error vs. no payment instructions
      const isServerError = error?.response && (error.response.status >= 500 || error.response.status === 0);
      const isNotFoundError = error?.response && error.response.status === 404;
      
      if (isServerError) {
        toast({
          title: "Service Temporarily Unavailable",
          description: "We're having trouble connecting to the payment network. Please try again in a few moments.",
          variant: "destructive",
        });
      } else if (isNotFoundError) {
        let message = "No payment instructions found for this recipient. Please verify the address is correct.";
        
        if (inputMode === 'npub') {
          message = "This Nostr profile doesn't have a Lightning Address configured. Please try a different recipient.";
        } else {
          message = "Neither DNS lookup nor Lightning invoice generation worked for this address. Please verify it is correct.";
        }
        
        toast({
          title: "Payment Lookup Error",
          description: message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Payment Lookup Error",
          description: "There was a problem verifying this recipient. Please check the address and try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsVerifyingPayment(false);
    }
  }

  async function sendHighFive(lightningInvoice: string) {
    if (!pendingHighFive) return;
    
    try {
      // High Five has already been created and posted to Nostr
      // All we need to do is close the payment modal and show the success screen
      
      // Close payment modal
      setPaymentModalOpen(false);
      
      // Show success screen with details that were already stored
      setSuccessDetails({
        ...pendingHighFive
      });
      
      // Clear pending high five
      setPendingHighFive(null);
    } catch (error) {
      console.error("Error displaying success screen:", error);
      toast({
        title: "Error",
        description: "There was a problem completing your High Five. Please try again.",
        variant: "destructive",
      });
      
      // Close payment modal
      setPaymentModalOpen(false);
    }
  }
  
  const closePaymentModal = () => {
    setPaymentModalOpen(false);
    setPendingHighFive(null);
  };
  
  const closeSuccessScreen = () => {
    setSuccessDetails(null);
    
    // Preserve Nostr user if connected when resetting form
    form.reset({
      recipient: "",
      reason: "",
      sender: nostrUser || "",
    });
  };

  return (
    <>
      {successDetails ? (
        <SuccessScreen 
          highFive={successDetails} 
          onClose={closeSuccessScreen} 
        />
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="recipient"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <div className="flex justify-between items-center">
                    <FormLabel className="font-futura font-bold text-lg">Who to High Five</FormLabel>
                    <div className="flex items-center text-xs space-x-2">
                      <span className="text-gray-500 font-normal">Use:</span>
                      
                      {/* Simple dropdown instead */}
                      <select
                        value={inputMode}
                        onChange={(e) => setInputMode(e.target.value as 'btag' | 'npub')}
                        className="text-xs h-7 px-2 py-1 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent min-w-[120px]"
                      >
                        <option value="btag">₿tag</option>
                        <option value="npub">npub</option>
                      </select>
                    </div>
                  </div>
                  <FormControl>
                    <div className="relative">
                      {inputMode === 'btag' && (
                        <span className="absolute inset-y-0 left-3 flex items-center text-black">₿</span>
                      )}
                      <Input
                        placeholder={
                          inputMode === 'btag' ? "LN Address or BIP-353 address" : 
                          "Enter an npub..."
                        }
                        className={`p-3 ${inputMode === 'btag' ? 'pl-8' : 'pl-3'} focus:ring-primary placeholder:text-gray-400 placeholder:font-normal`}
                        {...field}
                      />
                    </div>
                  </FormControl>

                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="font-futura font-bold text-lg">For what?</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Tell them (specifically!) what they did that made bitcoin better."
                      className="p-3 focus:ring-primary placeholder:text-gray-400 placeholder:font-normal"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />



            <FormField
              control={form.control}
              name="sender"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="font-futura font-bold text-lg">From:</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={nostrUser ? "Connected with Nostr" : "Your name or handle (Optional)"}
                      className={`p-3 focus:ring-primary placeholder:text-gray-400 placeholder:font-normal ${nostrUser ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      readOnly={!!nostrUser}
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={isVerifyingPayment}
              className="w-full bg-primary hover:bg-primary/90 text-white font-futura font-bold py-3 px-6 rounded-lg transition duration-300"
            >
              {isVerifyingPayment ? (
                <div className="flex items-center justify-center">
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-t-transparent border-white"></div>
                  Verifying Payment Details...
                </div>
              ) : (
                "Send High Five"
              )}
            </Button>
          </form>
        </Form>
      )}

      {pendingHighFive && (
        <PaymentModal
          isOpen={paymentModalOpen}
          highFiveDetails={pendingHighFive}
          onClose={closePaymentModal}
          onConfirmPayment={sendHighFive}
        />
      )}
    </>
  );
}