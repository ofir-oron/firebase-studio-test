
import type { LucideIcon } from 'lucide-react';

export interface User {
  id: string; // Firebase UID
  name: string | null; // Firebase displayName, can be null
  email: string | null; // Firebase email, can be null
  avatar?: string | null; // Firebase photoURL, can be null
}

export type EventTypeKey = 
  | "sick_day" 
  | "child_sick_day" 
  | "vacation" 
  | "pto" 
  | "away" 
  | "leaving_early" 
  | "arriving_late" 
  | "reserve_duty";

export interface EventType {
  value: EventTypeKey;
  label: string;
  icon: LucideIcon;
}

export interface CalendarEvent {
  id: string;
  userId: string;
  title: string;
  startDate: Date;
  endDate: Date;
  eventType: EventTypeKey;
  additionalText?: string;
  isFullDay: boolean;
  recipients: string[]; // email addresses or list IDs
  createdAt: Date;
  updatedAt: Date;
}

export interface MailingList {
  id: string;
  name: string;
  emails: string[];
}
