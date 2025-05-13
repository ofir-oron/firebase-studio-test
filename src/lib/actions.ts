
"use server";

import { z } from "zod";
import type { CalendarEvent, MailingList } from "./types";
import { MOCK_EVENTS, EVENT_TYPES, MAILING_LISTS as MOCK_MAILING_LISTS } from "./constants"; // Using mock data
import { revalidatePath } from "next/cache";

// Simulate a database
let events: CalendarEvent[] = [...MOCK_EVENTS];
let mailingLists: MailingList[] = [...MOCK_MAILING_LISTS];


const eventSchemaBase = z.object({
  title: z.string().min(1, "Title is required"),
  eventType: z.enum(EVENT_TYPES.map(et => et.value) as [string, ...string[]]),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isFullDay: z.boolean(),
  additionalText: z.string().optional(),
  recipients: z.array(z.string()).min(1, "At least one recipient is required"),
  userId: z.string(), // Assume userId is passed from authenticated session
});

const createEventSchema = eventSchemaBase;
const updateEventSchema = eventSchemaBase.extend({ id: z.string() });


export async function createCalendarEvent(formData: FormData) {
  try {
    const data = Object.fromEntries(formData.entries());
    // Manual parsing for dates and boolean, as FormData sends strings
    const parsedData = {
      ...data,
      startDate: new Date(data.startDate as string),
      endDate: new Date(data.endDate as string),
      isFullDay: data.isFullDay === 'true',
      recipients: JSON.parse(data.recipients as string),
      userId: data.userId as string, // This should come from session server-side
    };
    
    const validatedData = createEventSchema.parse(parsedData);

    // Simulate API call latency
    await new Promise(res => setTimeout(res, 1000));

    const newEvent: CalendarEvent = {
      ...validatedData,
      id: `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    events.push(newEvent);

    console.log("Event created:", newEvent);
    console.log("Email sent to:", validatedData.recipients.join(", "));
    
    revalidatePath("/calendar-overview");
    revalidatePath("/send-event"); // To clear form potentially

    return { success: true, message: "Event created successfully!", event: newEvent };
  } catch (error) {
    console.error("Error creating event:", error);
    if (error instanceof z.ZodError) {
      return { success: false, message: "Validation failed", errors: error.flatten().fieldErrors };
    }
    return { success: false, message: "Failed to create event. Please try again." };
  }
}

export async function updateCalendarEvent(formData: FormData) {
  try {
    const data = Object.fromEntries(formData.entries());
    const parsedData = {
      ...data,
      startDate: new Date(data.startDate as string),
      endDate: new Date(data.endDate as string),
      isFullDay: data.isFullDay === 'true',
      recipients: JSON.parse(data.recipients as string),
      userId: data.userId as string,
      id: data.id as string,
    };

    const validatedData = updateEventSchema.parse(parsedData);
    
    await new Promise(res => setTimeout(res, 1000));

    const eventIndex = events.findIndex(e => e.id === validatedData.id && e.userId === validatedData.userId);
    if (eventIndex === -1) {
      return { success: false, message: "Event not found or not authorized." };
    }

    const updatedEvent = {
      ...events[eventIndex],
      ...validatedData,
      updatedAt: new Date(),
    };
    events[eventIndex] = updatedEvent;

    console.log("Event updated:", updatedEvent);
    console.log("Update email sent to:", validatedData.recipients.join(", "));
    
    revalidatePath("/calendar-overview");

    return { success: true, message: "Event updated successfully!", event: updatedEvent };
  } catch (error) {
    console.error("Error updating event:", error);
    if (error instanceof z.ZodError) {
      return { success: false, message: "Validation failed", errors: error.flatten().fieldErrors };
    }
    return { success: false, message: "Failed to update event. Please try again." };
  }
}


export async function deleteCalendarEvent(eventId: string, userId: string) {
  try {
    await new Promise(res => setTimeout(res, 1000));
    
    const eventIndex = events.findIndex(e => e.id === eventId && e.userId === userId);
    if (eventIndex === -1) {
      return { success: false, message: "Event not found or not authorized." };
    }
    
    const deletedEvent = events.splice(eventIndex, 1)[0];
    console.log("Event deleted:", deletedEvent);
    console.log("Cancellation email sent for event:", eventId);
    
    revalidatePath("/calendar-overview");

    return { success: true, message: "Event deleted successfully!" };
  } catch (error) {
    console.error("Error deleting event:", error);
    return { success: false, message: "Failed to delete event. Please try again." };
  }
}

export async function getUserEvents(userId: string): Promise<CalendarEvent[]> {
  // Simulate fetching events for a user
  await new Promise(res => setTimeout(res, 500));
  return events.filter(event => event.userId === userId).sort((a,b) => b.startDate.getTime() - a.startDate.getTime());
}

export async function getMailingLists(): Promise<MailingList[]> {
  await new Promise(res => setTimeout(res, 300));
  return mailingLists;
}

const settingsSchema = z.object({
  newListName: z.string().min(1, "List name cannot be empty.").optional(),
  newListEmails: z.string().refine(val => {
    if (!val) return true; // Optional if newListName is not provided
    return val.split(',').every(email => z.string().email().safeParse(email.trim()).success);
  }, "Provide a comma-separated list of valid email addresses.").optional(),
  updatedLists: z.array(z.object({
    id: z.string(),
    name: z.string().min(1, "List name cannot be empty."),
    emails: z.string().refine(val => val.split(',').every(email => z.string().email().safeParse(email.trim()).success), "Provide a comma-separated list of valid email addresses.")
  })).optional(),
});


export async function saveMailingLists(formData: FormData) {
  // This is a simplified example. A real implementation would handle individual list updates, creations, deletions.
  // For now, we'll just log the intent or update a global mock list.
  const newListName = formData.get("newListName") as string;
  const newListEmailsRaw = formData.get("newListEmails") as string; // comma separated
  
  // This part is tricky with FormData for arrays of objects.
  // A real app would likely send JSON or use a more structured approach.
  // For this mock, we'll just log the new list data.

  try {
    if (newListName && newListEmailsRaw) {
      const emails = newListEmailsRaw.split(',').map(e => e.trim()).filter(e => z.string().email().safeParse(e).success);
      if (emails.length > 0) {
        const newList: MailingList = {
          id: `ml_${Date.now()}`,
          name: newListName,
          emails: emails,
        };
        mailingLists.push(newList);
        console.log("New mailing list added:", newList);
      } else if (newListEmailsRaw) { // if emails were provided but none were valid
         throw new Error("Invalid email format in new list.");
      }
    }
    
    // Example of how to handle updates if data was structured (e.g. JSON.parse(formData.get("updatedLists")))
    // const updatedListsData = formData.get("updatedLists") ? JSON.parse(formData.get("updatedLists") as string) : [];
    // updatedListsData.forEach((listData: any) => {
    //   const index = mailingLists.findIndex(ml => ml.id === listData.id);
    //   if (index !== -1) {
    //     mailingLists[index] = { ...mailingLists[index], name: listData.name, emails: listData.emails.split(',').map((e:string) => e.trim()) };
    //   }
    // });

    console.log("Mailing list settings (intent to save):", { newListName, newListEmailsRaw });
    await new Promise(res => setTimeout(res, 1000)); // Simulate save
    revalidatePath("/settings");
    return { success: true, message: "Mailing list settings updated." };

  } catch (error) {
    console.error("Error saving mailing lists:", error);
    if (error instanceof z.ZodError) {
      return { success: false, message: "Validation failed", errors: error.flatten().fieldErrors };
    }
    return { success: false, message: (error as Error).message || "Failed to save mailing lists." };
  }
}
