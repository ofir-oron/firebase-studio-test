
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
        const userEventsData = await getUserEvents(user.id);
        // Assuming getUserEvents returns events with Date objects already correctly typed
        setEvents(userEventsData);
      } catch (error) {
        console.error("Failed to fetch user events:", error);
        setEvents([]); // Set to empty array on error
      } finally {
        setIsLoading(false);
      }
    } else if (!authLoading && !user) {
      setEvents([]); 
      setIsLoading(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (!authLoading) {
      fetchUserEvents();
    }
  }, [authLoading, fetchUserEvents]);

  if (authLoading || isLoading || events === null) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <span className="ml-2">Loading events...</span></div>;
  }

  if (!user) {
    return <p className="text-center text-muted-foreground py-8">Please log in to see your events.</p>;
  }
  
  return <EventList initialEvents={events} onRefresh={fetchUserEvents} />;
}
