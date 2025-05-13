"use client";

import React, { useState, useEffect } from "react";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, addDays } from "date-fns";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { createCalendarEvent } from "@/lib/actions";
import type { EventTypeKey } from "@/lib/types"; // EventType and MailingList types are not needed for props anymore
import { EVENT_TYPES, MAILING_LISTS } from "@/lib/constants"; // Import constants directly
import { CalendarIcon, Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";

// Props are no longer needed as constants are imported directly
interface SendEventFormProps {}

const getEventSchema = (eventTypes: typeof EVENT_TYPES) => z.object({
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

type SendEventFormValues = z.infer<ReturnType<typeof getEventSchema>>;

export function SendEventForm({}: SendEventFormProps) { // Removed props
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  
  const eventSchema = getEventSchema(EVENT_TYPES); // Use imported EVENT_TYPES

  const form = useForm<SendEventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      dateRange: { from: new Date(), to: new Date() },
      isFullDay: true,
      recipients: [],
      additionalText: "",
      title: ""
    },
  });

  const { control, handleSubmit, watch, setValue, formState: { errors } } = form;

  const watchedDateRange = watch("dateRange");
  const watchedEventType = watch("eventType");
  const watchedAdditionalText = watch("additionalText", "");

  useEffect(() => {
    if (user && watchedDateRange?.from && watchedEventType) {
      const eventTypeLabel = EVENT_TYPES.find(et => et.value === watchedEventType)?.label || watchedEventType; // Use imported EVENT_TYPES
      const dateStr = watchedDateRange.to && watchedDateRange.from.getTime() !== watchedDateRange.to.getTime()
        ? `${format(watchedDateRange.from, "MMM d")} - ${format(watchedDateRange.to, "MMM d, yyyy")}`
        : format(watchedDateRange.from, "MMM d, yyyy");
      
      let newTitle = `${user.name} - ${dateStr} - ${eventTypeLabel}`;
      if (watchedAdditionalText && watchedAdditionalText.trim().length > 0 && watchedAdditionalText.length <= 30) {
        newTitle += ` - ${watchedAdditionalText.trim()}`;
      }
      setValue("title", newTitle);
    }
  }, [user, watchedDateRange, watchedEventType, watchedAdditionalText, setValue]);


  const onSubmit: SubmitHandler<SendEventFormValues> = async (data) => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsLoading(true);

    const formData = new FormData();
    formData.append("title", data.title);
    formData.append("eventType", data.eventType);
    formData.append("startDate", data.dateRange.from.toISOString());
    formData.append("endDate", (data.dateRange.to ?? data.dateRange.from).toISOString());
    formData.append("isFullDay", String(data.isFullDay));
    if (data.additionalText) formData.append("additionalText", data.additionalText);
    formData.append("recipients", JSON.stringify(data.recipients));
    formData.append("userId", user.id);

    const result = await createCalendarEvent(formData);

    if (result.success) {
      toast({
        title: "Event Created",
        description: result.message || "Your event has been successfully scheduled.",
        variant: "default",
      });
      form.reset({ 
        dateRange: { from: new Date(), to: new Date() },
        isFullDay: true,
        recipients: [],
        additionalText: "",
        title: ""
      });
    } else {
      toast({
        title: "Error Creating Event",
        description: result.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Date Range */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormFieldItem error={errors.dateRange?.from?.message || errors.dateRange?.to?.message || (errors.dateRange as any)?.message}>
          <Label htmlFor="dateRange">Date Range</Label>
          <Controller
            name="dateRange"
            control={control}
            render={({ field }) => (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="dateRange"
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !field.value && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {field.value?.from ? (
                      field.value.to ? (
                        <>
                          {format(field.value.from, "LLL dd, y")} -{" "}
                          {format(field.value.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(field.value.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={field.value?.from}
                    selected={{ from: field.value.from, to: field.value.to }}
                    onSelect={(range) => field.onChange(range || { from: new Date(), to: new Date() })}
                    numberOfMonths={2}
                    disabled={(date) => date < addDays(new Date(), -1) && !isSameDay(date, new Date()) } // Disable past dates except today
                  />
                </PopoverContent>
              </Popover>
            )}
          />
        </FormFieldItem>

        {/* Event Type */}
        <FormFieldItem error={errors.eventType?.message}>
          <Label htmlFor="eventType">Event Type</Label>
          <Controller
            name="eventType"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <SelectTrigger id="eventType">
                  <SelectValue placeholder="Select event type" />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((type) => ( // Use imported EVENT_TYPES
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center">
                        <type.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormFieldItem>
      </div>
      
      {/* Title */}
      <FormFieldItem error={errors.title?.message}>
        <Label htmlFor="title">Title</Label>
        <Input id="title" {...form.register("title")} placeholder="e.g. John Doe - Vacation" />
      </FormFieldItem>

      {/* Additional Text */}
      <FormFieldItem error={errors.additionalText?.message}>
        <Label htmlFor="additionalText">Additional Text (Optional)</Label>
        <Textarea id="additionalText" {...form.register("additionalText")} placeholder="Any extra details for the event..." />
      </FormFieldItem>
      
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Full Day/Half Day Toggle */}
        <FormFieldItem error={errors.isFullDay?.message}>
          <div className="flex items-center space-x-2 pt-2">
             <Controller
                name="isFullDay"
                control={control}
                render={({ field }) => (
                   <Switch id="isFullDay" checked={field.value} onCheckedChange={field.onChange} />
                )} />
            <Label htmlFor="isFullDay" className="cursor-pointer">Full Day Event</Label>
          </div>
        </FormFieldItem>

        {/* Mailing List Selection */}
        <FormFieldItem error={errors.recipients?.message}>
          <Label htmlFor="recipients">Notify Mailing Lists</Label>
           <Controller
              name="recipients"
              control={control}
              render={({ field }) => (
                <Select onValueChange={(value) => field.onChange(value ? [value] : [])} value={field.value?.[0]}>
                  <SelectTrigger id="recipients">
                    <SelectValue placeholder="Select mailing list(s)" />
                  </SelectTrigger>
                  <SelectContent>
                    {MAILING_LISTS.map((list) => ( // Use imported MAILING_LISTS
                      <SelectItem key={list.id} value={list.id}>
                        {list.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-muted-foreground mt-1">Currently supports selecting one list. Multi-select coming soon.</p>
        </FormFieldItem>
      </div>

      <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
        Submit Event
      </Button>
    </form>
  );
}

// Helper component for consistent form field layout with errors
const FormFieldItem: React.FC<{ children: React.ReactNode, error?: string, className?: string }> = ({ children, error, className }) => (
  <div className={cn("space-y-2", className)}>
    {children}
    {error && <p className="text-sm text-destructive">{error}</p>}
  </div>
);

function isSameDay(date1: Date, date2: Date): boolean {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}
