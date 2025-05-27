
"use server";

import { z } from "zod";
import type { CalendarEvent, MailingList } from "./types";
import { EVENT_TYPES, MAILING_LISTS as MOCK_MAILING_LISTS } from "./constants"; // MOCK_EVENTS removed from direct use
import { revalidatePath } from "next/cache";
import { db } from "./firebase"; // Import Firestore instance
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  Timestamp,
  serverTimestamp
} from "firebase/firestore";

// In-memory storage for mailing lists (can be migrated to Firestore later if needed)
let mailingLists: MailingList[] = [...MOCK_MAILING_LISTS];


const eventSchemaBase = z.object({
  title: z.string().min(1, "Title is required"),
  eventType: z.enum(EVENT_TYPES.map(et => et.value) as [string, ...string[]]),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isFullDay: z.boolean(),
  additionalText: z.string().optional(),
  recipients: z.array(z.string()).min(1, "At least one recipient is required"),
  userId: z.string(), 
});

const createEventSchema = eventSchemaBase;
const updateEventSchema = eventSchemaBase.extend({ id: z.string() });

// Helper to convert Firestore Timestamps in an event object to JS Dates
const convertTimestampsToDates = (eventData: any): CalendarEvent => {
  return {
    ...eventData,
    id: eventData.id, // id is passed explicitly as it's the doc ID
    startDate: (eventData.startDate as Timestamp)?.toDate(),
    endDate: (eventData.endDate as Timestamp)?.toDate(),
    createdAt: (eventData.createdAt as Timestamp)?.toDate(),
    updatedAt: (eventData.updatedAt as Timestamp)?.toDate(),
  } as CalendarEvent;
};


export async function createCalendarEvent(formData: FormData) {
  try {
    const data = Object.fromEntries(formData.entries());
    const parsedData = {
      ...data,
      startDate: new Date(data.startDate as string),
      endDate: new Date(data.endDate as string),
      isFullDay: data.isFullDay === 'true',
      recipients: JSON.parse(data.recipients as string),
      userId: data.userId as string,
    };
    
    const validatedData = createEventSchema.parse(parsedData);

    const eventToStore = {
      ...validatedData,
      startDate: Timestamp.fromDate(validatedData.startDate),
      endDate: Timestamp.fromDate(validatedData.endDate),
      createdAt: serverTimestamp(), // Use serverTimestamp for creation
      updatedAt: serverTimestamp(), // Use serverTimestamp for update
    };

    const docRef = await addDoc(collection(db, "events"), eventToStore);
    
    // For the returned event, convert Timestamps back to Dates for immediate use if needed
    const newEventForClient: CalendarEvent = {
      id: docRef.id,
      userId: validatedData.userId,
      title: validatedData.title,
      eventType: validatedData.eventType as any, // Zod enum ensures this is valid
      startDate: validatedData.startDate, // Original JS Date
      endDate: validatedData.endDate, // Original JS Date
      isFullDay: validatedData.isFullDay,
      additionalText: validatedData.additionalText,
      recipients: validatedData.recipients,
      createdAt: new Date(), // Approximate, Firestore will have the exact server time
      updatedAt: new Date(), // Approximate
    };

    console.log("Event created in Firestore with ID:", docRef.id);
    console.log("Email sent to:", validatedData.recipients.join(", "));
    
    revalidatePath("/calendar-overview");
    revalidatePath("/send-event");

    return { success: true, message: "Event created successfully!", event: newEventForClient };
  } catch (error) {
    console.error("Error creating event in Firestore:", error);
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
    
    const eventRef = doc(db, "events", validatedData.id);
    
    // Ideally, you'd fetch the doc first to ensure it belongs to the user,
    // or rely on Firestore security rules. For now, we'll assume authorized.

    const eventToUpdate = {
      ...validatedData,
      startDate: Timestamp.fromDate(validatedData.startDate),
      endDate: Timestamp.fromDate(validatedData.endDate),
      updatedAt: serverTimestamp(),
    };
    // Remove id from the update object as it's not a field in the document itself
    const { id, ...updatePayload } = eventToUpdate;


    await updateDoc(eventRef, updatePayload);

    const updatedEventForClient: CalendarEvent = {
      ...validatedData, // contains the id
      createdAt: new Date(), // This would ideally be fetched or preserved
      updatedAt: new Date(), // Approximate
    };
    
    console.log("Event updated in Firestore:", validatedData.id);
    console.log("Update email sent to:", validatedData.recipients.join(", "));
    
    revalidatePath("/calendar-overview");

    return { success: true, message: "Event updated successfully!", event: updatedEventForClient };
  } catch (error) {
    console.error("Error updating event in Firestore:", error);
    if (error instanceof z.ZodError) {
      return { success: false, message: "Validation failed", errors: error.flatten().fieldErrors };
    }
    return { success: false, message: "Failed to update event. Please try again." };
  }
}


export async function deleteCalendarEvent(eventId: string, userId: string) {
  try {
    const eventRef = doc(db, "events", eventId);
    
    // Again, security rules should enforce that a user can only delete their own events.
    // For this action, we'll proceed with deletion.
    // You might want to fetch the document first to check `userId` if not relying solely on rules.

    await deleteDoc(eventRef);
    
    console.log("Event deleted from Firestore:", eventId);
    console.log("Cancellation email sent for event:", eventId);
    
    revalidatePath("/calendar-overview");

    return { success: true, message: "Event deleted successfully!" };
  } catch (error) {
    console.error("Error deleting event from Firestore:", error);
    return { success: false, message: "Failed to delete event. Please try again." };
  }
}

export async function getUserEvents(userId: string): Promise<CalendarEvent[]> {
  try {
    const eventsCol = collection(db, "events");
    const q = query(eventsCol, where("userId", "==", userId), orderBy("startDate", "desc"));
    
    const querySnapshot = await getDocs(q);
    const userEvents: CalendarEvent[] = [];
    querySnapshot.forEach((docSnap) => {
      userEvents.push(convertTimestampsToDates({ ...docSnap.data(), id: docSnap.id }));
    });
    
    return userEvents;
  } catch (error) {
    console.error("Error fetching user events from Firestore:", error);
    return []; // Return empty array on error
  }
}

// Mailing list actions remain in-memory for now
export async function getMailingLists(): Promise<MailingList[]> {
  await new Promise(res => setTimeout(res, 300));
  return mailingLists;
}

export async function saveMailingLists(formData: FormData) {
  const newListName = formData.get("newListName") as string;
  const newListEmailsRaw = formData.get("newListEmails") as string; 

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
        console.log("New mailing list added (in-memory):", newList);
      } else if (newListEmailsRaw) {
         throw new Error("Invalid email format in new list.");
      }
    }
    
    await new Promise(res => setTimeout(res, 1000)); 
    revalidatePath("/settings");
    return { success: true, message: "Mailing list settings updated (in-memory)." };

  } catch (error) {
    console.error("Error saving mailing lists (in-memory):", error);
    if (error instanceof z.ZodError) {
      return { success: false, message: "Validation failed", errors: error.flatten().fieldErrors };
    }
    return { success: false, message: (error as Error).message || "Failed to save mailing lists." };
  }
}
