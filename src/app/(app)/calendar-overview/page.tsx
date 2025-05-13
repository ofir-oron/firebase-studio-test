
import { EventList } from "@/components/calendar/EventList";
import { getUserEvents } from "@/lib/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { Metadata } from "next";
// For server-side fetching, we'd need to get the user ID.
// This is typically done via server-side auth helpers.
// For this example, we'll assume it's available or pass it down if using client component for fetching.
// Since getUserEvents is a server action, it can potentially access auth state if set up with cookies/headers.
// For now, we'll hardcode a mock user ID for demonstration if needed, or rely on client-side fetching with auth context.

export const metadata: Metadata = {
  title: `Calendar Overview - ${APP_NAME}`,
};


async function EventListWrapper() {
  // In a real app, you'd get the userId from the session
  // const session = await getAuthSession(); // placeholder for getting session
  // const userId = session?.user?.id;
  const mockUserId = "user1"; // Replace with actual user ID from session
  
  if (!mockUserId) {
    return <p>Please log in to see your events.</p>;
  }
  const events = await getUserEvents(mockUserId);
  return <EventList initialEvents={events} />;
}


export default function CalendarOverviewPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Calendar Overview</h1>
        <p className="text-muted-foreground">Review and manage your scheduled time off.</p>
      </header>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Your Events</CardTitle>
          <CardDescription>View, edit, or cancel your upcoming and past events.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <span className="ml-2">Loading events...</span></div>}>
            <EventListWrapper />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
