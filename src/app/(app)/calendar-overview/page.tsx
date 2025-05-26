
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import type { Metadata } from "next";
import { EventListClientWrapper } from '@/components/calendar/EventListClientWrapper';

export const metadata: Metadata = {
  title: `Calendar Overview - ${APP_NAME}`,
};


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
            <EventListClientWrapper />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
