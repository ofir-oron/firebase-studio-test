
"use client";

import { useEffect, useState, useCallback } from "react";
import { EventList } from "@/components/calendar/EventList";
import { getUserEvents } from "@/lib/actions";
import { useAuth } from "@/hooks/useAuth";
import type { CalendarEvent } from "@/lib/types";
import { Loader2 } from "lucide-react";

export function EventListClientWrapper() {
  const { user, loading: authLoading } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserEvents = useCallback(async () => {
    if (user?.id) {
      setIsLoading(true);
      try {
        console.log("[EventListClientWrapper] Fetching events for userId:", user.id);
        const userEventsData = await getUserEvents(user.id);
        console.log("[EventListClientWrapper] Received events data from getUserEvents:", userEventsData);
        setEvents(userEventsData);
      } catch (error) {
        console.error("[EventListClientWrapper] Failed to fetch user events:", error);
        setEvents([]); 
      } finally {
        setIsLoading(false);
      }
    } else if (!authLoading && !user) {
      console.log("[EventListClientWrapper] No authenticated user found after auth check. Setting events to empty array.");
      setEvents([]); 
      setIsLoading(false);
    } else if (authLoading) {
      console.log("[EventListClientWrapper] Auth is still loading, deferring event fetch.");
      // Do nothing, wait for authLoading to be false
    } else if (user && !user.id) {
      console.warn("[EventListClientWrapper] User object present, but user.id is missing. Cannot fetch events.");
      setEvents([]);
      setIsLoading(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    console.log("[EventListClientWrapper] useEffect triggered. authLoading:", authLoading);
    if (!authLoading) {
      fetchUserEvents();
    }
  }, [authLoading, fetchUserEvents]);

  if (authLoading || isLoading || events === null) {
    // Initial loading state or if events haven't been fetched yet (events is null)
    // Or if auth is still loading, or if events are actively being loaded (isLoading is true)
    return <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <span className="ml-2">Loading events...</span></div>;
  }

  if (!user) { // This should ideally be caught by isLoading or events === null if fetchUserEvents sets events to []
    return <p className="text-center text-muted-foreground py-8">Please log in to see your events.</p>;
  }
  
  // If events is an empty array, EventList will show "You have no scheduled events."
  return <EventList initialEvents={events} onRefresh={fetchUserEvents} />;
}
