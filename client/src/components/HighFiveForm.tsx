import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
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

const formSchema = z.object({
  recipient: z.string().min(1, {
    message: "Recipient is required",
  }),
  reason: z.string().min(1, {
    message: "Please explain what you're giving the High Five for",
  }),
  amount: z.coerce
    .number()
    .min(0, { message: "Amount cannot be negative" })
    .default(0),
  sender: z.string().optional(),
});

export default function HighFiveForm() {
  const { bitcoinBalance, setBitcoinBalance } = useStore();
  const { toast } = useToast();
  const [successDetails, setSuccessDetails] = useState<HighFiveDetails | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [pendingHighFive, setPendingHighFive] = useState<HighFiveDetails | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      recipient: "",
      reason: "",
      amount: 100000,
      sender: "",
    },
  });

  function handleFormSubmit(values: z.infer<typeof formSchema>) {
    // Check if user has enough bitcoins
    if (values.amount > bitcoinBalance) {
      toast({
        title: "Insufficient Balance",
        description: "You don't have enough bitcoins for this transaction.",
        variant: "destructive",
      });
      return;
    }

    // Append two line breaks and high five emojis to the reason
    const enhancedReason = `${values.reason}\n\n✋✋✋`;
    
    // Store the high five details and show payment modal
    setPendingHighFive({
      recipient: values.recipient,
      reason: enhancedReason,
      amount: values.amount,
      sender: values.sender || undefined,
    });
    
    // Open payment modal
    setPaymentModalOpen(true);
  }

  async function sendHighFive(qrCodeDataUrl: string) {
    if (!pendingHighFive) return;
    
    try {
      // Add QR code to the reason if available
      let enhancedReason = pendingHighFive.reason;
      if (qrCodeDataUrl) {
        enhancedReason = `${pendingHighFive.reason}\n\n![Payment QR](${qrCodeDataUrl})`;
      }
      
      // Send to API
      await apiRequest(
        'POST',
        '/api/high-fives', 
        {
          recipient: pendingHighFive.recipient,
          reason: enhancedReason,
          amount: pendingHighFive.amount,
          sender: pendingHighFive.sender,
        }
      );

      // Invalidate the high fives query cache
      queryClient.invalidateQueries({ queryKey: ['/api/high-fives'] });

      // Deduct from balance
      setBitcoinBalance(bitcoinBalance - pendingHighFive.amount);

      // Close payment modal
      setPaymentModalOpen(false);
      
      // Show success screen with details
      setSuccessDetails(pendingHighFive);
      
      // Clear pending high five
      setPendingHighFive(null);
    } catch (error) {
      console.error("Error submitting high five:", error);
      toast({
        title: "Error",
        description: "Failed to send your High Five. Please try again.",
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
    // Reset form after closing success screen
    form.reset();
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
                  <FormLabel className="font-futura font-bold text-lg">Who to High Five</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-3 flex items-center text-black">₿</span>
                      <Input
                        placeholder="Enter a ₿tag"
                        className="p-3 pl-8 focus:ring-primary placeholder:text-gray-400 placeholder:font-normal"
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
              name="amount"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="font-futura font-bold text-lg">
                    <span className="text-black">Bonus</span>
                    <span className="text-gray-400 font-normal"> (in bitcoins aka satoshis)</span>
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type="text"
                        inputMode="numeric"
                        className="p-3 pr-8 focus:ring-primary placeholder:text-gray-400 placeholder:font-normal"
                        {...field}
                      />
                      <span className="absolute inset-y-0 right-3 flex items-center text-primary">₿</span>
                    </div>
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
                      placeholder="Your name or handle (Optional)"
                      className="p-3 focus:ring-primary placeholder:text-gray-400 placeholder:font-normal"
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-white font-futura font-bold py-3 px-6 rounded-lg transition duration-300"
            >
              Send High Five
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
