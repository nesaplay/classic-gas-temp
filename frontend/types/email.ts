export type EmailPriority = "HIGH" | "MID" | "LOW";
export type EmailTopic = "General Inquiry" | "Support Request" | "Billing Question" | "Partnership Opportunity" | "Feedback" | "Product Update" | "Sales Lead" | "Job Application" | "Complaint" | "Other";

export interface Email {
  id: string;
  threadId?: string;
  subject?: string;
  sender?: string;
  recipient?: string; // Or recipients if multiple
  date: string; // ISO date string
  snippet?: string;
  body?: string | { html: string }; // HTML body
  bodyPlain?: string; // Plain text body
  labels?: string[]; // e.g., ["INBOX", "SENT", "SPAM", "TRASH", "UNREAD", "STARRED"]
  attachments?: Attachment[];
  isRead?: boolean;
  isStarred?: boolean; // Added for starring functionality
  priority?: EmailPriority;
  topic?: EmailTopic;
  hasAttachment?: boolean;
  isCalendarEvent?: boolean;

}

export interface Attachment {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
}

export interface GmailLabel {
  id: string;
  name: string;
  messageListVisibility?: string;
  labelListVisibility?: string;
  type?: string; // e.g., "system" or "user"
}
