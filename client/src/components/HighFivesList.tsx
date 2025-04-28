import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HighFiveDetails } from "@/lib/types";

export default function HighFivesList() {
  const { data: highFives, isLoading, error } = useQuery({
    queryKey: ['/api/high-fives'],
    queryFn: getQueryFn<HighFiveDetails[]>({ on401: "returnNull" }),
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
  // Don't need to sort by date yet as we don't have created_at field in our model
  // Just reverse the array to show newest entries first
  const sortedHighFives = [...highFives].reverse();

  return (
    <div className="space-y-6 py-2">
      {sortedHighFives.map((highFive, index) => (
        <Card key={index} className="bg-white shadow-md hover:shadow-lg transition-shadow">
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
                {highFive.sender ? (
                  <div>
                    <p className="text-sm text-gray-500">From</p>
                    <p className="font-medium">{highFive.sender}</p>
                  </div>
                ) : (
                  <div></div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}