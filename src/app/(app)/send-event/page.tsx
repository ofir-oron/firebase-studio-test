
import { SendEventForm } from "@/components/forms/SendEventForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
// EVENT_TYPES and MAILING_LISTS are no longer needed here for props
import { Metadata } from "next";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Send Event - ${APP_NAME}`,
};

export default function SendEventPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Create New Event</h1>
        <p className="text-muted-foreground">Schedule your time off and notify relevant parties.</p>
      </header>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Event Details</CardTitle>
          <CardDescription>Fill in the form below to create a new calendar event.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Removed eventTypes and mailingLists props */}
          <SendEventForm />
        </CardContent>
      </Card>
    </div>
  );
}
