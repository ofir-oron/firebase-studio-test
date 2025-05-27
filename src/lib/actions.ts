
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

// Helper to convert Firestore Timestamps/strings in an event object to JS Dates
const convertTimestampsToDates = (eventData: any, docId: string): CalendarEvent | null => {
  const logPrefix = `[actions.convertTimestampsToDates for doc ${docId}]`;

  const convertField = (fieldValue: any, fieldName: string): Date => {
    if (fieldValue instanceof Timestamp) {
      // console.log(`${logPrefix} '${fieldName}' is a Timestamp. Converting.`);
      return fieldValue.toDate();
    }
    if (typeof fieldValue === 'string') {
      // console.log(`${logPrefix} '${fieldName}' is a string ('${fieldValue}'). Attempting to parse as Date.`);
      const d = new Date(fieldValue);
      if (isNaN(d.getTime())) {
        console.warn(`${logPrefix} Failed to parse '${fieldName}' string to a valid Date: '${fieldValue}'`);
        return new Date(NaN); // Return an invalid date explicitly
      }
      return d;
    }
    // Handle cases where data might be a plain object from Firestore if not directly a Timestamp (e.g. after JSON stringify/parse)
    if (fieldValue && typeof fieldValue === 'object' && typeof fieldValue.seconds === 'number' && typeof fieldValue.nanoseconds === 'number') {
      // console.log(`${logPrefix} '${fieldName}' looks like a Firestore Timestamp-like object. Converting.`);
      return new Timestamp(fieldValue.seconds, fieldValue.nanoseconds).toDate();
    }
    console.warn(`${logPrefix} '${fieldName}' is not a Timestamp, string, or Timestamp-like object. Value:`, fieldValue, `Type: ${typeof fieldValue}`);
    return new Date(NaN); // Return an invalid date for other types
  };

  const startDate = convertField(eventData.startDate, "startDate");
  const endDate = convertField(eventData.endDate, "endDate");
  
  // Critical check: if startDate or endDate are invalid, the event is unusable for display.
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    console.error(`${logPrefix} Event has invalid startDate or endDate after conversion. Raw startDate: ${JSON.stringify(eventData.startDate)}, Raw endDate: ${JSON.stringify(eventData.endDate)}. Converted startDate: ${startDate}, Converted endDate: ${endDate}. Skipping event.`);
    return null;
  }

  const createdAt = convertField(eventData.createdAt, "createdAt");
  const updatedAt = convertField(eventData.updatedAt, "updatedAt");

  // Ensure all fields of CalendarEvent are present
  const result: CalendarEvent = {
    id: docId,
    userId: eventData.userId,
    title: eventData.title,
    eventType: eventData.eventType,
    additionalText: eventData.additionalText,
    isFullDay: eventData.isFullDay,
    recipients: eventData.recipients,
    startDate,
    endDate,
    createdAt: isNaN(createdAt.getTime()) ? new Date() : createdAt, // Fallback for non-critical dates
    updatedAt: isNaN(updatedAt.getTime()) ? new Date() : updatedAt, // Fallback
  };
  return result;
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
  if (!userId || typeof userId !== 'string' || userId.trim() === "") {
    console.error("[actions.getUserEvents] userId is invalid (undefined, not a string, or empty). Returning empty array.");
    return [];
  }
  try {
    const eventsCol = collection(db, "events");
    const q = query(eventsCol, where("userId", "==", userId), orderBy("startDate", "desc"));
    
    const querySnapshot = await getDocs(q);
    console.log(`[actions.getUserEvents] Firestore query for userId '${userId}' returned ${querySnapshot.size} documents.`);
    
    const userEvents: CalendarEvent[] = [];
    querySnapshot.forEach((docSnap) => {
      const eventData = docSnap.data();
      // Minimal log for raw data to avoid excessive logging if stringify is problematic.
      console.log(`[actions.getUserEvents] Processing doc ${docSnap.id}. userId from doc: '${eventData.userId}'. Query userId: '${userId}'.`);

      const convertedEvent = convertTimestampsToDates(eventData, docSnap.id);

      if (convertedEvent) {
        userEvents.push(convertedEvent);
      } else {
        // Specific error already logged in convertTimestampsToDates
        console.warn(`[actions.getUserEvents] Event ${docSnap.id} for userId '${userId}' was skipped due to critical conversion errors (e.g., invalid startDate/endDate). Check previous logs from 'convertTimestampsToDates'.`);
      }
    });
    
    console.log(`[actions.getUserEvents] Successfully processed. Returning ${userEvents.length} events for userId '${userId}'.`);
    return userEvents;
  } catch (error) {
    console.error(`[actions.getUserEvents] Error fetching/processing user events from Firestore for userId '${userId}':`, error);
    if (typeof error === 'object' && error !== null && 'code' in error && (error as any).code === 'permission-denied') {
        console.error(`[actions.getUserEvents] Firestore permission denied for userId '${userId}'. Check your Firestore security rules.`);
    }
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
          id: `ml_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,
          name: newListName,
          emails: emails,
        };
        mailingLists.push(newList);
        console.log("[actions.saveMailingLists] New mailing list added (in-memory):", newList);
      } else if (newListEmailsRaw) { 
         throw new Error("Invalid email format in new list. All provided emails were invalid.");
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
    

    