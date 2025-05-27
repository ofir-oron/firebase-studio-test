
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
    console.warn(`${logPrefix} '${fieldName}' ('${String(fieldValue)}') is not a Timestamp, string, or Timestamp-like object. Type: ${typeof fieldValue}. Returning invalid Date.`);
    return new Date(NaN); // Return an invalid date for other types
  };

  const startDate = convertField(eventData.startDate, "startDate");
  const endDate = convertField(eventData.endDate, "endDate");
  
  // Critical check: if startDate or endDate are invalid, the event is unusable for display.
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    console.error(`${logPrefix} Event has invalid startDate or endDate after conversion. Raw startDate: ${JSON.stringify(eventData.startDate)}, Raw endDate: ${JSON.stringify(eventData.endDate)}. Converted startDate: ${startDate}, Converted endDate: ${endDate}. Skipping event.`);
    return null;
  }

  // For createdAt/updatedAt, if they are missing or invalid, we can default them, but it's good to log.
  let createdAt, updatedAt;
  if (eventData.createdAt) {
    createdAt = convertField(eventData.createdAt, "createdAt");
    if (isNaN(createdAt.getTime())) {
        console.warn(`${logPrefix} 'createdAt' was present but invalid. Defaulting to now.`);
        createdAt = new Date();
    }
  } else {
    console.warn(`${logPrefix} 'createdAt' field missing. Defaulting to now.`);
    createdAt = new Date();
  }

  if (eventData.updatedAt) {
    updatedAt = convertField(eventData.updatedAt, "updatedAt");
    if (isNaN(updatedAt.getTime())) {
        console.warn(`${logPrefix} 'updatedAt' was present but invalid. Defaulting to now.`);
        updatedAt = new Date();
    }
  } else {
    console.warn(`${logPrefix} 'updatedAt' field missing. Defaulting to now.`);
    updatedAt = new Date();
  }


  // Ensure all fields of CalendarEvent are present
  const result: CalendarEvent = {
    id: docId,
    userId: eventData.userId,
    title: eventData.title,
    eventType: eventData.eventType,
    additionalText: eventData.additionalText || "", // Ensure optional fields are at least empty strings
    isFullDay: typeof eventData.isFullDay === 'boolean' ? eventData.isFullDay : true, // Default if not boolean
    recipients: Array.isArray(eventData.recipients) ? eventData.recipients : [], // Default if not array
    startDate,
    endDate,
    createdAt, 
    updatedAt, 
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
      createdAt: new Date(), // Note: This should ideally be the original createdAt, not new Date()
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
    console.log(`[actions.getUserEvents] Attempting to query 'events' collection with userId: '${userId}' and orderBy 'startDate' descending. IMPORTANT: If this query returns 0 documents unexpectedly, please verify: 1) Your Firestore security rules allow this read. 2) A composite index (userId ASC, startDate DESC) exists and is active for the 'events' collection.`);
    const q = query(eventsCol, where("userId", "==", userId), orderBy("startDate", "desc"));
    
    const querySnapshot = await getDocs(q);
    console.log(`[actions.getUserEvents] Firestore query for userId '${userId}' returned ${querySnapshot.size} documents.`);
    
    const userEvents: CalendarEvent[] = [];
    querySnapshot.forEach((docSnap) => {
      const eventData = docSnap.data();
      console.log(`[actions.getUserEvents] Processing doc ${docSnap.id}. Raw data: ${JSON.stringify(eventData)}. Document userId: '${eventData.userId}'. Query userId: '${userId}'.`);

      const convertedEvent = convertTimestampsToDates(eventData, docSnap.id);

      if (convertedEvent) {
        userEvents.push(convertedEvent);
      } else {
        console.warn(`[actions.getUserEvents] Event ${docSnap.id} for userId '${userId}' was skipped due to critical conversion errors (e.g., invalid startDate/endDate). Check previous logs from 'convertTimestampsToDates'.`);
      }
    });
    
    console.log(`[actions.getUserEvents] Successfully processed. Returning ${userEvents.length} events for userId '${userId}'.`);
    return userEvents;
  } catch (error) {
    console.error(`[actions.getUserEvents] Error fetching/processing user events from Firestore for userId '${userId}':`, error);
    if (typeof error === 'object' && error !== null && 'code' in error) {
        const firebaseError = error as { code: string; message: string };
        console.error(`[actions.getUserEvents] Firebase error code: ${firebaseError.code}, message: ${firebaseError.message}`);
        if (firebaseError.code === 'permission-denied') {
            console.error(`[actions.getUserEvents] CRITICAL: Firestore permission denied for userId '${userId}'. Check your Firestore security rules.`);
        } else if (firebaseError.code === 'failed-precondition') {
             console.error(`[actions.getUserEvents] CRITICAL: Firestore query requires an index that is missing or still building. Message: ${firebaseError.message}. Please check the Firebase console for index creation prompts.`);
        }
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
    

    
