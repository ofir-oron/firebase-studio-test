
"use server";

import { z } from "zod";
import type { CalendarEvent, MailingList } from "./types";
import { EVENT_TYPES, MAILING_LISTS as MOCK_MAILING_LISTS } from "./constants";
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
    startDate: (eventData.startDate instanceof Timestamp) ? eventData.startDate.toDate() : eventData.startDate,
    endDate: (eventData.endDate instanceof Timestamp) ? eventData.endDate.toDate() : eventData.endDate,
    createdAt: (eventData.createdAt instanceof Timestamp) ? eventData.createdAt.toDate() : eventData.createdAt,
    updatedAt: (eventData.updatedAt instanceof Timestamp) ? eventData.updatedAt.toDate() : eventData.updatedAt,
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
      createdAt: serverTimestamp(), 
      updatedAt: serverTimestamp(), 
    };

    const docRef = await addDoc(collection(db, "events"), eventToStore);
    
    const newEventForClient: CalendarEvent = {
      id: docRef.id,
      userId: validatedData.userId,
      title: validatedData.title,
      eventType: validatedData.eventType as any, 
      startDate: validatedData.startDate, 
      endDate: validatedData.endDate, 
      isFullDay: validatedData.isFullDay,
      additionalText: validatedData.additionalText,
      recipients: validatedData.recipients,
      createdAt: new Date(), 
      updatedAt: new Date(), 
    };

    console.log("[actions.createCalendarEvent] Event created in Firestore with ID:", docRef.id);
    
    revalidatePath("/calendar-overview");
    revalidatePath("/send-event");

    return { success: true, message: "Event created successfully!", event: newEventForClient };
  } catch (error) {
    console.error("[actions.createCalendarEvent] Error creating event in Firestore:", error);
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
    
    const eventToUpdate = {
      ...validatedData,
      startDate: Timestamp.fromDate(validatedData.startDate),
      endDate: Timestamp.fromDate(validatedData.endDate),
      updatedAt: serverTimestamp(),
    };
    const { id, ...updatePayload } = eventToUpdate;


    await updateDoc(eventRef, updatePayload);

    const updatedEventForClient: CalendarEvent = {
      ...validatedData, 
      createdAt: new Date(), 
      updatedAt: new Date(), 
    };
    
    console.log("[actions.updateCalendarEvent] Event updated in Firestore:", validatedData.id);
    
    revalidatePath("/calendar-overview");

    return { success: true, message: "Event updated successfully!", event: updatedEventForClient };
  } catch (error) {
    console.error("[actions.updateCalendarEvent] Error updating event in Firestore:", error);
    if (error instanceof z.ZodError) {
      return { success: false, message: "Validation failed", errors: error.flatten().fieldErrors };
    }
    return { success: false, message: "Failed to update event. Please try again." };
  }
}


export async function deleteCalendarEvent(eventId: string, userId: string) {
  try {
    const eventRef = doc(db, "events", eventId);
    await deleteDoc(eventRef);
    console.log("[actions.deleteCalendarEvent] Event deleted from Firestore:", eventId);
    revalidatePath("/calendar-overview");
    return { success: true, message: "Event deleted successfully!" };
  } catch (error) {
    console.error("[actions.deleteCalendarEvent] Error deleting event from Firestore:", error);
    return { success: false, message: "Failed to delete event. Please try again." };
  }
}

export async function getUserEvents(userId: string): Promise<CalendarEvent[]> {
  console.log(`[actions.getUserEvents] Received request for userId: '${userId}'`);
  if (!userId) {
    console.error("[actions.getUserEvents] userId is undefined or empty. Returning empty array.");
    return [];
  }
  try {
    const eventsCol = collection(db, "events");
    // Ensure the userId field in Firestore exactly matches the one being queried.
    const q = query(eventsCol, where("userId", "==", userId), orderBy("startDate", "desc"));
    
    const querySnapshot = await getDocs(q);
    console.log(`[actions.getUserEvents] Firestore query for userId '${userId}' returned ${querySnapshot.size} documents.`);
    
    const userEvents: CalendarEvent[] = [];
    querySnapshot.forEach((docSnap) => {
      // console.log(`[actions.getUserEvents] Raw data for doc ${docSnap.id}:`, docSnap.data());
      try {
        const eventData = docSnap.data();
        const convertedEvent = convertTimestampsToDates({ ...eventData, id: docSnap.id });
        
        // Stricter check for valid Date objects after conversion
        if (convertedEvent.startDate instanceof Date && !isNaN(convertedEvent.startDate.getTime()) &&
            convertedEvent.endDate instanceof Date && !isNaN(convertedEvent.endDate.getTime())) {
          userEvents.push(convertedEvent);
        } else {
          console.warn(`[actions.getUserEvents] Skipped event ${docSnap.id} for userId '${userId}' due to invalid/missing dates after conversion. startDate: ${convertedEvent.startDate}, endDate: ${convertedEvent.endDate}`);
        }
      } catch (e) {
          console.error(`[actions.getUserEvents] Error converting event ${docSnap.id} for userId '${userId}':`, e);
      }
    });
    
    console.log(`[actions.getUserEvents] Successfully processed and converted ${userEvents.length} events for userId '${userId}'.`);
    return userEvents;
  } catch (error) {
    console.error(`[actions.getUserEvents] Error fetching/processing user events from Firestore for userId '${userId}':`, error);
    return []; 
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
        console.log("[actions.saveMailingLists] New mailing list added (in-memory):", newList);
      } else if (newListEmailsRaw) {
         throw new Error("Invalid email format in new list.");
      }
    }
    
    await new Promise(res => setTimeout(res, 1000)); 
    revalidatePath("/settings");
    return { success: true, message: "Mailing list settings updated (in-memory)." };

  } catch (error) {
    console.error("[actions.saveMailingLists] Error saving mailing lists (in-memory):", error);
    if (error instanceof z.ZodError) {
      return { success: false, message: "Validation failed", errors: error.flatten().fieldErrors };
    }
    return { success: false, message: (error as Error).message || "Failed to save mailing lists." };
  }
}
