
"use client";

import React, { useState, useEffect } from "react";
import type { CalendarEvent, EventType, EventTypeKey, MailingList } from "@/lib/types";
import { EVENT_TYPES, MAILING_LISTS } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, isSameDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Calendar as CalendarWidget } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { updateCalendarEvent, deleteCalendarEvent } from "@/lib/actions";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { CalendarIcon, Edit3, Loader2, Trash2, RotateCcw, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface EventListProps {
  initialEvents: CalendarEvent[] | null; // Allow null for initial state
  onRefresh: () => Promise<void>;
}

const getEventSchema = (eventTypes: EventType[]) => z.object({
  id: z.string(),
  dateRange: z.object({
    from: z.date({ required_error: "Start date is required." }),
    to: z.date().optional(),
  }).refine(data => data.to ? data.to >= data.from : true, {
    message: "End date cannot be before start date.",
    path: ["to"],
  }),
  eventType: z.enum(eventTypes.map(et => et.value) as [EventTypeKey, ...EventTypeKey[]], {
    required_error: "Event type is required.",
  }),
  title: z.string().min(1, "Title is required."),
  additionalText: z.string().optional(),
  isFullDay: z.boolean().default(true),
  recipients: z.array(z.string()).min(1, "At least one recipient list is required."),
});

type EventFormValues = z.infer<ReturnType<typeof getEventSchema>>;

export function EventList({ initialEvents, onRefresh }: EventListProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);


  const eventSchema = getEventSchema(EVENT_TYPES);
  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
  });

  const { control, handleSubmit, watch, setValue, reset, formState: { errors: formErrors } } = form;

  const watchedDateRange = watch("dateRange");
  const watchedEventType = watch("eventType");
  const watchedAdditionalText = watch("additionalText");

  useEffect(() => {
    if (initialEvents) {
      // Ensure all events have valid Date objects for startDate and endDate
      const processedEvents = initialEvents.map(event => {
        const startDate = event.startDate instanceof Date ? event.startDate : new Date(event.startDate);
        const endDate = event.endDate instanceof Date ? event.endDate : new Date(event.endDate);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          console.error(`EventList rendering: event.startDate or event.endDate is not a Date object for event ID ${event.id}. Title: ${event.title}. Raw startDate: ${event.startDate}, Raw endDate: ${event.endDate}`);
          // Potentially filter out this event or mark it as erroneous
          return { ...event, _hasDateError: true, startDate: new Date(NaN), endDate: new Date(NaN) }; // Mark error
        }
        return { ...event, startDate, endDate, _hasDateError: false };
      });
      setEvents(processedEvents as CalendarEvent[]); // Cast back, _hasDateError is temporary for processing
    } else {
      setEvents([]);
    }
  }, [initialEvents]);

  useEffect(() => {
    if (selectedEvent && user && watchedDateRange?.from && watchedEventType && selectedEvent.startDate instanceof Date && selectedEvent.endDate instanceof Date && !isNaN(selectedEvent.startDate.getTime()) && !isNaN(selectedEvent.endDate.getTime())) {
      const eventTypeLabel = EVENT_TYPES.find(et => et.value === watchedEventType)?.label || watchedEventType;
      const dateStr = watchedDateRange.to && watchedDateRange.from.getTime() !== watchedDateRange.to.getTime()
        ? `${format(new Date(watchedDateRange.from), "MMM d")} - ${format(new Date(watchedDateRange.to), "MMM d, yyyy")}`
        : format(new Date(watchedDateRange.from), "MMM d, yyyy");
      
      let newTitle = `${user.name} - ${dateStr} - ${eventTypeLabel}`;
      if (watchedAdditionalText && watchedAdditionalText.trim().length > 0 && watchedAdditionalText.length <= 30) {
        newTitle += ` - ${watchedAdditionalText.trim()}`;
      }
      setValue("title", newTitle);
    }
  }, [user, selectedEvent, watchedDateRange, watchedEventType, watchedAdditionalText, setValue]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
  };

  const handleEdit = (event: CalendarEvent) => {
    if (!(event.startDate instanceof Date) || !(event.endDate instanceof Date) || isNaN(event.startDate.getTime()) || isNaN(event.endDate.getTime())) {
        toast({ title: "Error", description: "Cannot edit event with invalid dates.", variant: "destructive"});
        return;
    }
    setSelectedEvent(event);
    reset({
      id: event.id,
      dateRange: { from: event.startDate, to: event.endDate }, 
      eventType: event.eventType,
      title: event.title,
      additionalText: event.additionalText || "",
      isFullDay: event.isFullDay,
      recipients: event.recipients,
    });
    setIsEditDialogOpen(true);
  };

  const onUpdateSubmit: SubmitHandler<EventFormValues> = async (data) => {
    if (!user || !selectedEvent) return;
    setIsUpdating(true);

    const formData = new FormData();
    formData.append("id", selectedEvent.id);
    formData.append("title", data.title);
    formData.append("eventType", data.eventType);
    formData.append("startDate", data.dateRange.from.toISOString());
    formData.append("endDate", (data.dateRange.to ?? data.dateRange.from).toISOString());
    formData.append("isFullDay", String(data.isFullDay));
    if (data.additionalText) formData.append("additionalText", data.additionalText);
    formData.append("recipients", JSON.stringify(data.recipients));
    formData.append("userId", user.id);

    const result = await updateCalendarEvent(formData);
    if (result.success) {
      toast({ title: "Event Updated", description: result.message });
      await onRefresh();
      setIsEditDialogOpen(false);
    } else {
      toast({ title: "Error Updating Event", description: result.message, variant: "destructive" });
    }
    setIsUpdating(false);
  };

  const handleDelete = async (eventId: string) => {
    if (!user) return;
    setIsDeleting(true);
    const result = await deleteCalendarEvent(eventId, user.id);
    if (result.success) {
      toast({ title: "Event Deleted", description: result.message });
      await onRefresh();
    } else {
      toast({ title: "Error Deleting Event", description: result.message, variant: "destructive" });
    }
    setIsDeleting(false);
  };

  const getEventTypeDetails = (typeKey: EventTypeKey) => {
    return EVENT_TYPES.find(et => et.value === typeKey) || EVENT_TYPES[0];
  };

  if (events.length === 0) {
    return (
      <div className="text-center py-8 px-4">
        <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-lg mb-2">You have no scheduled events.</p>
        <p className="text-sm text-muted-foreground mb-4">
          If you've recently added events and they aren't appearing, try refreshing.
          If the issue persists, there might be a delay or a configuration issue with data fetching.
        </p>
        <Button onClick={handleRefresh} variant="outline" size="sm" className="mt-2" disabled={isRefreshing}>
          <RotateCcw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh Events
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
       <div className="flex justify-end">
        <Button onClick={handleRefresh} variant="outline" size="sm" disabled={isRefreshing}>
          <RotateCcw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh Events
        </Button>
      </div>
      {events.map((event) => {
        // @ts-ignore _hasDateError is a temporary processing flag
        if (event._hasDateError || !(event.startDate instanceof Date) || !(event.endDate instanceof Date) || isNaN(event.startDate.getTime()) || isNaN(event.endDate.getTime())) {
          return (
            <Card key={event.id || `error-${Math.random()}`} className="overflow-hidden shadow-md border-destructive">
              <CardHeader className="flex flex-row items-start bg-destructive/10 gap-4 p-4">
                 <AlertCircle className="h-6 w-6 text-destructive" />
                <div className="flex-1">
                  <CardTitle className="text-lg text-destructive">Error Displaying Event</CardTitle>
                  <CardDescription className="text-destructive/80">
                    This event (ID: {event.id || 'N/A'}) could not be displayed due to invalid date information.
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
          );
        }
        const eventTypeDetails = getEventTypeDetails(event.eventType);
        const startDate = event.startDate; // Already confirmed as Date object
        const endDate = event.endDate; // Already confirmed as Date object

        return (
          <Card key={event.id} className="overflow-hidden shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-start bg-muted/50 gap-4 p-4">
              <div className="flex items-center justify-center bg-primary/20 text-primary rounded-full p-3">
                <eventTypeDetails.icon className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg">{event.title}</CardTitle>
                <CardDescription>
                  {format(startDate, "EEE, MMM d, yyyy")} - {format(endDate, "EEE, MMM d, yyyy")}
                </CardDescription>
              </div>
               <div className="flex space-x-2">
                <Button variant="outline" size="icon" onClick={() => handleEdit(event)}>
                  <Edit3 className="h-4 w-4" />
                  <span className="sr-only">Edit</span>
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="icon">
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the event
                        and send a cancellation notification.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(event.id)} disabled={isDeleting}>
                        {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardHeader>
            {event.additionalText && (
              <CardContent className="p-4 text-sm">
                <p>{event.additionalText}</p>
              </CardContent>
            )}
            <CardFooter className="p-4 bg-muted/20 text-xs text-muted-foreground">
                <span>Type: {eventTypeDetails.label}</span>
                <span className="mx-2">|</span>
                <span>{event.isFullDay ? "Full Day" : "Partial Day"}</span>
                 <span className="mx-2">|</span>
                <span>Recipients: {event.recipients.map(rId => MAILING_LISTS.find(ml => ml.id === rId)?.name || rId).join(', ')}</span>
            </CardFooter>
          </Card>
        );
      })}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
            <DialogDescription>Make changes to your event details below.</DialogDescription>
          </DialogHeader>
          {selectedEvent && (
            <form onSubmit={handleSubmit(onUpdateSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
               {/* Date Range */}
                <FormFieldItem error={formErrors.dateRange?.from?.message || formErrors.dateRange?.to?.message || (formErrors.dateRange as any)?.message}>
                  <Label htmlFor="editDateRange">Date Range</Label>
                  <Controller
                    name="dateRange"
                    control={control}
                    render={({ field }) => (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            id="editDateRange"
                            variant={"outline"}
                            className={cn("w-full justify-start text-left font-normal", !field.value?.from && "text-muted-foreground")}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value?.from ? (field.value.to ? (<>{format(field.value.from, "LLL dd, y")} - {format(field.value.to, "LLL dd, y")}</>) : format(field.value.from, "LLL dd, y")) : (<span>Pick a date range</span>)}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarWidget initialFocus mode="range" defaultMonth={field.value?.from} selected={field.value?.from ? { from: field.value.from, to: field.value.to } : undefined} onSelect={(range) => field.onChange(range || { from: new Date(), to: new Date() })} numberOfMonths={1} disabled={(date) => date < addDays(new Date(), -1) && !isSameDay(date, addDays(new Date(), -1)) }/>
                        </PopoverContent>
                      </Popover>
                    )}
                  />
                </FormFieldItem>

                {/* Event Type */}
                <FormFieldItem error={formErrors.eventType?.message}>
                  <Label htmlFor="editEventType">Event Type</Label>
                  <Controller
                    name="eventType"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <SelectTrigger id="editEventType"><SelectValue placeholder="Select event type" /></SelectTrigger>
                        <SelectContent>
                          {EVENT_TYPES.map((type) => (<SelectItem key={type.value} value={type.value}><div className="flex items-center"><type.icon className="mr-2 h-4 w-4 text-muted-foreground" />{type.label}</div></SelectItem>))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormFieldItem>
              
              {/* Title */}
              <FormFieldItem error={formErrors.title?.message}>
                <Label htmlFor="editTitle">Title</Label>
                <Input id="editTitle" {...form.register("title")} />
              </FormFieldItem>

              {/* Additional Text */}
              <FormFieldItem error={formErrors.additionalText?.message}>
                <Label htmlFor="editAdditionalText">Additional Text</Label>
                <Textarea id="editAdditionalText" {...form.register("additionalText")} />
              </FormFieldItem>
              
              {/* Full Day/Half Day & Recipients */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormFieldItem error={formErrors.isFullDay?.message}>
                  <div className="flex items-center space-x-2 pt-2">
                    <Controller name="isFullDay" control={control} render={({ field }) => (<Switch id="editIsFullDay" checked={field.value} onCheckedChange={field.onChange} />)} />
                    <Label htmlFor="editIsFullDay" className="cursor-pointer">Full Day Event</Label>
                  </div>
                </FormFieldItem>
                <FormFieldItem error={formErrors.recipients?.message}>
                  <Label htmlFor="editRecipients">Notify Mailing Lists</Label>
                  <Controller name="recipients" control={control} render={({ field }) => (
                      <Select onValueChange={(value) => field.onChange(value ? [value] : [])} value={field.value?.[0]}>
                        <SelectTrigger id="editRecipients"><SelectValue placeholder="Select mailing list(s)" /></SelectTrigger>
                        <SelectContent>
                          {MAILING_LISTS.map((list) => (<SelectItem key={list.id} value={list.id}>{list.name}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormFieldItem>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
                <Button type="submit" disabled={isUpdating}>
                  {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper component for consistent form field layout with errors
const FormFieldItem: React.FC<{ children: React.ReactNode, error?: string, className?: string }> = ({ children, error, className }) => (
  <div className={cn("space-y-2", className)}>
    {children}
    {error && <p className="text-sm text-destructive">{error}</p>}
  </div>
);
    
    