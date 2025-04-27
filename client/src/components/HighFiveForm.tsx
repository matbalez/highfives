import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  const { bitcoinBalance, setBitcoinBalance, showNotification } = useStore();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      recipient: "",
      reason: "",
      amount: 0,
      sender: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    // Check if user has enough bitcoins
    if (values.amount > bitcoinBalance) {
      toast({
        title: "Insufficient Balance",
        description: "You don't have enough bitcoins for this transaction.",
        variant: "destructive",
      });
      return;
    }

    // Deduct from balance
    setBitcoinBalance(bitcoinBalance - values.amount);

    // Show notification
    showNotification();

    // Reset form
    form.reset();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="recipient"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel className="font-futura font-bold">Who to High Five</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter ₿tag or on-chain address"
                  className="p-3 focus:ring-primary"
                  {...field}
                />
              </FormControl>
              <FormDescription className="text-sm text-gray-600">
                ₿tag or on-chain address
              </FormDescription>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="reason"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel className="font-futura font-bold">For what?</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Share your appreciation..."
                  className="p-3 focus:ring-primary"
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormDescription className="text-sm text-gray-600">
                Tell them (specifically!) what they did that made bitcoin better.
              </FormDescription>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel className="font-futura font-bold">Bonus:</FormLabel>
              <FormControl>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center text-gray-500">₿</span>
                  <Input
                    type="number"
                    placeholder="0"
                    className="p-3 pl-8 focus:ring-primary"
                    min={0}
                    {...field}
                  />
                </div>
              </FormControl>
              <FormDescription className="text-sm text-gray-600">
                bitcoins (aka satoshis)
              </FormDescription>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="sender"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel className="font-futura font-bold">From:</FormLabel>
              <FormControl>
                <Input
                  placeholder="Your name or handle"
                  className="p-3 focus:ring-primary"
                  {...field}
                />
              </FormControl>
              <FormDescription className="text-sm text-gray-600">
                Your name or handle. Optional.
              </FormDescription>
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full bg-primary hover:bg-primary/90 text-white font-futura font-bold py-3 px-6 rounded-lg transition duration-300 flex items-center justify-center"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 mr-2"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          Send High Five
        </Button>
      </form>
    </Form>
  );
}
