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
  sender: string | null;
  createdAt: string;
  nostrEventId?: string;
  profileName?: string;
  senderProfileName?: string;
  qrCodePath?: string;
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
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <Skeleton className="h-6 w-[40%] rounded" />
                  <Skeleton className="h-4 w-[20%] rounded" />
                </div>
                <Skeleton className="h-16 w-full rounded" />
                <div className="flex justify-between">
                  <Skeleton className="h-5 w-[30%] rounded" />
                  <Skeleton className="h-5 w-[25%] rounded" />
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
              <div>
                <p className="text-xl font-bold break-words">
                  {highFive.recipient.startsWith('npub') 
                    ? (highFive.profileName || highFive.recipient)
                    : <><span className="text-black">₿</span>{highFive.recipient}</>}
                </p>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4 shadow-inner">
                <p className="italic text-gray-700 whitespace-pre-line">{highFive.reason}</p>
              </div>
              
              <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                <div>
                  <p className="text-xs text-gray-400 font-normal font-sans">
                    {format(parseISO(highFive.createdAt), 'MMM d')}
                  </p>
                </div>
                {highFive.sender && highFive.sender !== '<send anonymously>' && (
                  <div className="w-full sm:text-right">
                    <p className="font-medium break-words">
                      From: {highFive.sender?.startsWith('npub')
                        ? (highFive.senderProfileName || highFive.sender)
                        : highFive.sender}
                    </p>
                  </div>
                )}
              </div>
              
              {/* QR Code if available - only for BOLT12 offers */}
              {highFive.qrCodePath && (
                <div className="mt-4 mb-2 flex flex-col items-center">
                  <p className="text-sm text-gray-600 mb-2">Scan with your BOLT12 wallet:</p>
                  <img 
                    src={highFive.qrCodePath} 
                    alt="QR Code for BOLT12 offer" 
                    className="w-48 h-48 object-contain" 
                  />
                </div>
              )}
              
              {/* Nostr link if available */}
              {highFive.nostrEventId && (
                <div className="pt-3 text-center w-full">
                  <a 
                    href={`https://nostr.watch/e/${highFive.nostrEventId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80 text-sm font-medium underline"
                  >
                    See on Nostr
                  </a>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}