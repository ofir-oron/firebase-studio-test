
import type { EventType, MailingList, CalendarEvent } from '@/lib/types'; // CalendarEvent import
import { Activity, Baby, Plane, CalendarClock, MapPin, ChevronsUp, ChevronsDown, Shield } from 'lucide-react';

export const APP_NAME = "TimeWise";

export const EVENT_TYPES: EventType[] = [
  { value: "sick_day", label: "Sick Day", icon: Activity },
  { value: "child_sick_day", label: "Child Sick Day", icon: Baby },
  { value: "vacation", label: "Vacation", icon: Plane },
  { value: "pto", label: "PTO", icon: CalendarClock },
  { value: "away", label: "Away", icon: MapPin },
  { value: "leaving_early", label: "Leaving Early", icon: ChevronsUp },
  { value: "arriving_late", label: "Arriving Late", icon: ChevronsDown },
  { value: "reserve_duty", label: "Reserve Duty", icon: Shield },
];

export const MAILING_LISTS: MailingList[] = [
  { id: "managers", name: "Managers", emails: ["manager1@example.com", "manager2@example.com"] },
  { id: "team_alpha", name: "Team Alpha", emails: ["alpha_lead@example.com", "memberA@example.com"] },
  { id: "hr_department", name: "HR Department", emails: ["hr@example.com"] },
];

// MOCK_EVENTS are no longer the primary source for live data,
// as events will be stored in Firestore.
// This can be kept for reference or potential seeding scripts.
export const MOCK_EVENTS: CalendarEvent[] = [
  {
    id: "event1_mock", // Mock IDs should be distinct if ever used for seeding
    userId: "mockUser1FirebaseUid", 
    title: "Alice Wonderland - Vacation (Mock)",
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 10),
    endDate: new Date(new Date().getFullYear(), new Date().getMonth(), 15),
    eventType: "vacation",
    isFullDay: true,
    recipients: ["managers"],
    createdAt: new Date(),
    updatedAt: new Date(),
    additionalText: "Trip to Hawaii! (Mock)"
  },
  {
    id: "event2_mock",
    userId: "mockUser1FirebaseUid",
    title: "Alice Wonderland - Sick Day (Mock)",
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 20),
    endDate: new Date(new Date().getFullYear(), new Date().getMonth(), 20),
    eventType: "sick_day",
    isFullDay: true,
    recipients: ["managers"],
    createdAt: new Date(),
    updatedAt: new Date(),
  }
];
