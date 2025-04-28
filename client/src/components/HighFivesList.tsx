import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";

// Define the type for high fives from the server
interface ServerHighFive {
  id: number;
  recipient: string;
  reason: string;
  amount: number;
  sender: string | null;
  createdAt: string;
}

export default function HighFivesList() {
  const { data: highFives, isLoading, error } = useQuery({
    queryKey: ['/api/high-fives'],
    queryFn: getQueryFn<ServerHighFive[]>({ on401: "returnNull" }),
  });
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index} className="bg-white shadow-md">
            <CardContent className="p-5">
              <div className="space-y-3">
                <Skeleton className="h-4 w-[70%] rounded" />
                <Skeleton className="h-4 w-[80%] rounded" />
                <Skeleton className="h-12 w-full rounded" />
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-[25%] rounded" />
                  <Skeleton className="h-4 w-[15%] rounded" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10">
        <p className="text-red-500 font-bold">Failed to load High Fives</p>
      </div>
    );
  }

  if (!highFives || highFives.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-500">No High Fives have been sent yet</p>
      </div>
    );
  }

  // Sort highFives in reverse chronological order (newest first)
  const sortedHighFives = [...highFives].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="space-y-6 py-2">
      {sortedHighFives.map((highFive) => (
        <Card key={highFive.id} className="bg-white shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-5">
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-gray-600">To:</p>
                  <p className="text-xl font-bold mt-1">
                    <span className="text-black">₿</span>{highFive.recipient}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Amount</p>
                  <p className="text-lg font-bold">{highFive.amount.toLocaleString()} <span className="text-primary">₿</span></p>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4 shadow-inner">
                <p className="italic text-gray-700">{highFive.reason}</p>
              </div>
              
              <div className="flex justify-between items-center">
                <div>
                  {highFive.sender && (
                    <>
                      <p className="text-sm text-gray-500">From</p>
                      <p className="font-medium">{highFive.sender}</p>
                    </>
                  )}
                </div>
                <div className="text-xs text-gray-400">
                  {format(parseISO(highFive.createdAt), 'MMM d, yyyy')}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}