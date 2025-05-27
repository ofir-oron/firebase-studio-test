
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
    startDate: (eventData.startDate instanceof Timestamp) ? eventData.startDate.toDate() : new Date(eventData.startDate as string), // Added fallback for string dates if not Timestamp
    endDate: (eventData.endDate instanceof Timestamp) ? eventData.endDate.toDate() : new Date(eventData.endDate as string), // Added fallback
    createdAt: (eventData.createdAt instanceof Timestamp) ? eventData.createdAt.toDate() : new Date(eventData.createdAt as string), // Added fallback
    updatedAt: (eventData.updatedAt instanceof Timestamp) ? eventData.updatedAt.toDate() : new Date(eventData.updatedAt as string), // Added fallback
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
    
    // Construct the event object as it would be after fetching and converting timestamps
    const newEventForClient: CalendarEvent = {
      id: docRef.id,
      userId: validatedData.userId,
      title: validatedData.title,
      eventType: validatedData.eventType as any, 
      startDate: validatedData.startDate, // JS Date
      endDate: validatedData.endDate, // JS Date
      isFullDay: validatedData.isFullDay,
      additionalText: validatedData.additionalText,
      recipients: validatedData.recipients,
      createdAt: new Date(), // Approximate, actual value is serverTimestamp
      updatedAt: new Date(), // Approximate
    };

    console.log("[actions.createCalendarEvent] Event created in Firestore with ID:", docRef.id);
    
    revalidatePath("/calendar-overview");
    revalidatePath("/send-event"); // revalidate send-event if needed, or remove if not

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
    // remove id from update payload as it's part of the doc ref.
    const { id, ...updatePayload } = eventToUpdate;


    await updateDoc(eventRef, updatePayload);

    // Construct the event object as it would be after fetching and converting timestamps
    const updatedEventForClient: CalendarEvent = {
      ...validatedData, // has JS dates
      createdAt: new Date(), // This would ideally be the original createdAt, not new Date()
      updatedAt: new Date(), // Approximate
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
    // Optional: Add a check here to ensure the event belongs to the user before deleting,
    // though Firestore rules should also enforce this.
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
      console.log(`[actions.getUserEvents] Raw data for doc ${docSnap.id}:`, JSON.stringify(eventData)); // Log raw data
      console.log(`[actions.getUserEvents] Document userId from Firestore: '${eventData.userId}', Query userId: '${userId}'`); // Log userId from doc

      try {
        const convertedEvent = convertTimestampsToDates({ ...eventData, id: docSnap.id });
        
        // Stricter check for valid Date objects after conversion
        if (convertedEvent.startDate instanceof Date && !isNaN(convertedEvent.startDate.getTime()) &&
            convertedEvent.endDate instanceof Date && !isNaN(convertedEvent.endDate.getTime())) {
          userEvents.push(convertedEvent);
        } else {
          console.warn(`[actions.getUserEvents] Skipped event ${docSnap.id} for userId '${userId}' due to invalid/missing dates after conversion. Raw startDate: ${eventData.startDate}, Raw endDate: ${eventData.endDate}. Converted startDate: ${convertedEvent.startDate}, Converted endDate: ${convertedEvent.endDate}`);
        }
      } catch (e) {
          console.error(`[actions.getUserEvents] Error converting event ${docSnap.id} for userId '${userId}':`, e);
      }
    });
    
    console.log(`[actions.getUserEvents] Successfully processed and converted ${userEvents.length} events for userId '${userId}'.`);
    return userEvents;
  } catch (error) {
    console.error(`[actions.getUserEvents] Error fetching/processing user events from Firestore for userId '${userId}':`, error);
    // Check if it's a Firebase permission error specifically
    if (typeof error === 'object' && error !== null && 'code' in error && (error as any).code === 'permission-denied') {
        console.error(`[actions.getUserEvents] Firestore permission denied for userId '${userId}'. Check your Firestore security rules.`);
    }
    return []; 
  }
}

// Mailing list actions remain in-memory for now
export async function getMailingLists(): Promise<MailingList[]> {
  // Simulate async fetch if these were from a DB
  await new Promise(res => setTimeout(res, 300)); // Simulate network delay
  return mailingLists;
}

export async function saveMailingLists(formData: FormData) {
  const newListName = formData.get("newListName") as string;
  const newListEmailsRaw = formData.get("newListEmails") as string; 

  // This is just an example for in-memory, a real DB would handle updates/deletes differently
  try {
    // For this example, we'll just focus on adding new lists from FormData
    // A real implementation would handle updates to existing lists or deletions
    if (newListName && newListEmailsRaw) {
      const emails = newListEmailsRaw.split(',').map(e => e.trim()).filter(e => z.string().email().safeParse(e).success);
      if (emails.length > 0) {
        const newList: MailingList = {
          id: `ml_${Date.now()}_${Math.random().toString(36).substring(2,7)}`, // More unique ID
          name: newListName,
          emails: emails,
        };
        mailingLists.push(newList);
        console.log("[actions.saveMailingLists] New mailing list added (in-memory):", newList);
      } else if (newListEmailsRaw) { // Only throw error if emails were provided but all were invalid
         throw new Error("Invalid email format in new list. All provided emails were invalid.");
      }
    }
    
    // Simulate saving to a persistent store
    await new Promise(res => setTimeout(res, 1000)); 
    revalidatePath("/settings"); // Revalidate to show new list if form is part of a server component data flow
    return { success: true, message: "Mailing list settings updated (in-memory)." };

  } catch (error) {
    console.error("[actions.saveMailingLists] Error saving mailing lists (in-memory):", error);
    if (error instanceof z.ZodError) {
      return { success: false, message: "Validation failed", errors: error.flatten().fieldErrors };
    }
    return { success: false, message: (error as Error).message || "Failed to save mailing lists." };
  }
}

    