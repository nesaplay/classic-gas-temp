import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Email, EmailPriority, EmailTopic, GmailLabel } from "@/types/email";
import { PROJECT_CONFIG } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { DB_TABLES } from "../constants";

// Define constants for Priorities and Topics
export const EMAIL_PRIORITIES: EmailPriority[] = ["HIGH", "MID", "LOW"];
export const EMAIL_TOPICS: EmailTopic[] = [
  "General Inquiry",
  "Support Request",
  "Billing Question",
  "Partnership Opportunity",
  "Feedback",
  "Product Update",
  "Sales Lead",
  "Job Application",
  "Complaint",
  "Other",
];

const createDraftPrompt = async (email: Email): Promise<string> => {
  return `Write a professional and polite response email to the following message.
Only provide the email body without subject or signature blocks.
The original email was sent by ${email.sender} on ${email.date}.
Here is the email body:
Please write a clear, well-structured response addressing the content of the email.
Email in context bellow`;
};

const summarizeEmail = async (email: Email): Promise<string> => {
  return `From: ${email.sender}\n    Subject: ${email.subject}\n    Body:\n    ${email.bodyPlain || email.snippet}`;
};

interface EmailStore {
  emails: Email[];
  isOpen: boolean;
  activeEmail: Email | null;
  labels: GmailLabel[];
  lastFetchNextPageToken: string | null;
  lastFetchTotalEmails: number | null;
  setEmails: (emails: Email[]) => void;
  setIsOpen: (isOpen: boolean) => void;
  setActiveEmail: (email: Email | null) => void;
  fetchLabels: () => Promise<void>;
  draftEmailResponse: (email: Email) => Promise<string>;
  streamDigestDraft: (email: Email, onWord: (wordChunk: string) => void) => Promise<string>;
  summarizeEmail: (email: Email) => Promise<string>;
  deleteEmails: (emailIds: string[]) => Promise<void>;
  archiveEmails: (emailIds: string[]) => Promise<void>;
  markEmailAsUnread: (emailId: string) => Promise<void>;
  markEmailAsRead: (emailId: string) => Promise<void>;
  moveEmailToFolder: (emailId: string, folderId: string) => Promise<void>;
  getEmailsByLabel: (label: string) => Email[];
  sendActiveEmail: (originalMessageId: string, replyBody: string, cc?: string) => Promise<void>;
  setFetchedEmailData: (data: { emails: Email[]; nextPageToken: string | null; totalEmails: number }) => void;
  isLoading: boolean;
  error: string | null;
  cachedEmailDrafts: { [emailId: string]: string };
  setCachedEmailDraft: (emailId: string, draft: string) => void;
  updateEmailMetadata: (payload: {
    email_id: string;
    topic?: string;
    priority?: "HIGH" | "MID" | "LOW";
  }) => void;
}

// Helper function to deduplicate emails by ID, keeping the last occurrence
const getUniqueEmailsByIdKeepLast = (emailList: Email[]): Email[] => {
  if (!emailList || !Array.isArray(emailList)) return [];
  const emailMap = new Map<string, Email>();
  emailList.forEach((email) => {
    if (email && typeof email.id === "string") {
      // Ensure email and email.id are valid
      emailMap.set(email.id, email);
    }
  });
  return Array.from(emailMap.values());
};

const initialStateDefinition = {
  emails: [] as Email[],
  isOpen: false,
  activeEmail: null as Email | null,
  labels: [] as GmailLabel[],
  lastFetchNextPageToken: null as string | null,
  lastFetchTotalEmails: null as number | null,
  isLoading: false,
  error: null as string | null,
  cachedEmailDrafts: {} as { [emailId: string]: string },
};

const isValidEmailTopic = (topic: any): topic is EmailTopic => {
  return typeof topic === "string" && EMAIL_TOPICS.includes(topic as EmailTopic);
};

export const useEmailStore = create<EmailStore>()(
  devtools(
    (set, get) => ({
      ...initialStateDefinition,
      setEmails: (emails) => set({ emails: getUniqueEmailsByIdKeepLast(emails) }),
      setIsOpen: (isOpen) => set({ isOpen }),
      setActiveEmail: (activeEmail) => set({ activeEmail }),
      setCachedEmailDraft: (emailId, draft) =>
        set((state) => ({
          cachedEmailDrafts: {
            ...state.cachedEmailDrafts,
            [emailId]: draft,
          },
        })),
      setFetchedEmailData: (data) => {
        const uniqueEmails = getUniqueEmailsByIdKeepLast(data.emails);
        set({
          emails: uniqueEmails,
          lastFetchNextPageToken: data.nextPageToken,
          lastFetchTotalEmails: data.totalEmails,
        });
      },
      draftEmailResponse: async (emailForPrompt) => {
        return createDraftPrompt(emailForPrompt);
      },
      streamDigestDraft: async (email: Email, onWord: (wordChunk: string) => void): Promise<string> => {
        console.log(`[useEmailStore] streamDigestDraft called for email ID: ${email.id}`);

        const assistantConfig = PROJECT_CONFIG.assistants?.find((a) => a.id === "email-management");
        if (!assistantConfig || !assistantConfig.assistantId) {
          const errMsg = "Email management assistant configuration is missing or invalid.";
          console.error("[useEmailStore]", errMsg);
          onWord(`Error: ${errMsg}`);
          throw new Error(errMsg);
        }
        const assistantId = assistantConfig.assistantId;

        const emailContext = {
          subject: email.subject,
          from: email.sender,
          date: email.date,
          snippet: email.snippet,
          body: email.bodyPlain || email.snippet,
        };

        const instructions = await createDraftPrompt(email);

        try {
          set({ isLoading: true, error: null });
          const response = await fetch("/api/chat/draft-response", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: instructions,
              context: emailContext,
              assistantId: assistantId,
            }),
          });

          if (!response.ok) {
            let errorData;
            try {
              errorData = await response.json();
            } catch (e) {
              errorData = { error: `HTTP error ${response.status}: ${response.statusText}` };
            }
            const errorMessage = errorData?.error || "Server error generating draft response";
            console.error("[useEmailStore] API error from /api/chat/draft-response:", errorMessage, errorData);
            set({ isLoading: false, error: errorMessage });
            onWord(`Error: ${errorMessage.substring(0, 100)}${errorMessage.length > 100 ? "..." : ""}`);
            throw new Error(errorMessage);
          }

          const result = await response.json();
          const fullDraft = result.draft;
          set({ isLoading: false });

          if (typeof fullDraft !== "string") {
            const errMsg = "Invalid draft content received from server (not a string).";
            console.error("[useEmailStore]", errMsg, fullDraft);
            onWord(`Error: ${errMsg}`);
            throw new Error(errMsg);
          }

          if (fullDraft.trim() === "") {
            console.warn(`[useEmailStore] Received empty draft for email ID ${email.id}.`);
            onWord("(No draft content generated)");
            return "";
          }

          console.log(
            `[useEmailStore] Received full draft for email ID ${email.id}, length: ${fullDraft.length}. Simulating streaming...`,
          );

          const chunks = fullDraft.split(/(\s+)/);
          for (const chunk of chunks) {
            if (chunk.length > 0) {
              onWord(chunk);
              await new Promise((resolve) => setTimeout(resolve, 10));
            }
          }

          console.log(`[useEmailStore] Finished simulating streaming for email ID ${email.id}`);
          return fullDraft;
        } catch (error: any) {
          console.error("[useEmailStore] Error in streamDigestDraft:", error);
          set({ isLoading: false, error: error.message || "Unknown error in streamDigestDraft" });
          if (
            !(
              error.message &&
              (error.message.includes("already informed UI") ||
                error.message.includes("Server error generating draft response") ||
                error.message.includes("Invalid draft content received"))
            )
          ) {
            onWord(`Error: ${(error.message || "Unknown error while drafting.").substring(0, 100)}`);
          }
          throw error;
        }
      },
      summarizeEmail: async (emailToSummarize) => {
        return summarizeEmail(emailToSummarize);
      },
      deleteEmails: async (emailIds) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch("/api/gmail/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ emailIds }),
          });
          if (!response.ok) throw new Error("Failed to delete emails");
          set((state) => ({
            emails: state.emails.filter((email) => !emailIds.includes(email.id)),
            isLoading: false,
          }));
        } catch (error: any) {
          console.error("Error deleting emails:", error);
          set({ isLoading: false, error: error.message });
          throw error;
        }
      },
      archiveEmails: async (emailIds) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch("/api/gmail/archive", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ emailIds }),
          });
          if (!response.ok) throw new Error("Failed to archive emails");
          set((state) => ({
            emails: state.emails.filter((email) => !emailIds.includes(email.id)),
            isLoading: false,
          }));
        } catch (error: any) {
          console.error("Error archiving emails:", error);
          set({ isLoading: false, error: error.message });
          throw error;
        }
      },
      markEmailAsUnread: async (emailId) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch("/api/gmail/mark-as-unread", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ emailId }),
          });
          if (!response.ok) throw new Error("Failed to mark email as unread");
          set((state) => ({
            emails: state.emails.map((email) =>
              email.id === emailId
                ? { ...email, labels: [...(email.labels || []).filter((label: string) => label !== "READ"), "UNREAD"] }
                : email,
            ),
            activeEmail:
              state.activeEmail?.id === emailId
                ? {
                    ...state.activeEmail,
                    labels: [...(state.activeEmail.labels || []).filter((label: string) => label !== "READ"), "UNREAD"],
                  }
                : state.activeEmail,
            isLoading: false,
          }));
        } catch (error: any) {
          console.error("Error marking email as unread:", error);
          set({ isLoading: false, error: error.message });
          throw error;
        }
      },
      markEmailAsRead: async (emailId) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch("/api/gmail/mark-as-read", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ emailId }),
          });
          if (!response.ok) throw new Error("Failed to mark email as read");
          set((state) => ({
            emails: state.emails.map((email) =>
              email.id === emailId
                ? { ...email, labels: (email.labels || []).filter((label: string) => label !== "UNREAD") }
                : email,
            ),
            activeEmail:
              state.activeEmail?.id === emailId
                ? {
                    ...state.activeEmail,
                    labels: (state.activeEmail.labels || []).filter((label: string) => label !== "UNREAD"),
                  }
                : state.activeEmail,
            isLoading: false,
          }));
        } catch (error: any) {
          console.error("Error marking email as read:", error);
          set({ isLoading: false, error: error.message });
          throw error;
        }
      },
      moveEmailToFolder: async (emailId, folderId) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch("/api/gmail/move-to-folder", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ emailId, folderId }),
          });
          if (!response.ok) throw new Error("Failed to move email to folder");
          set((state) => ({
            emails: state.emails.filter((email) => email.id !== emailId),
            isLoading: false,
          }));
        } catch (error: any) {
          console.error("Error moving email to folder:", error);
          set({ isLoading: false, error: error.message });
          throw error;
        }
      },
      fetchLabels: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch("/api/gmail/labels");
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || "Failed to fetch labels");
          }
          const fetchedLabels: GmailLabel[] = await response.json();
          const filteredLabels = fetchedLabels.filter((label) => {
            if (label.type === "system") {
              return ["INBOX", "SPAM", "TRASH", "IMPORTANT", "STARRED", "SENT", "DRAFT"].includes(label.id);
            }
            return label.type === "user";
          });
          set({ labels: filteredLabels, isLoading: false });
        } catch (error: any) {
          console.error("Error fetching labels:", error);
          set({ isLoading: false, error: error.message });
        }
      },
      getEmailsByLabel: (label) => {
        return get().emails.filter((email) => email.labels?.includes(label));
      },
      sendActiveEmail: async (originalMessageId: string, replyBody: string, cc?: string) => {
        set({ isLoading: true, error: null });
        console.log(`Sending email reply to original message ID: ${originalMessageId}`);
        try {
          const response = await fetch("/api/gmail/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              originalMessageId,
              replyBody,
              cc,
            }),
          });
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const apiErrorMessage = errorData.error || errorData.message || "Failed to send email via API";
            console.error("sendActiveEmail API error:", apiErrorMessage, errorData);
            throw new Error(apiErrorMessage);
          }
          const result = await response.json();
          console.log("Send successful:", result);
          set({ isLoading: false, error: null });
        } catch (error: any) {
          console.error("sendActiveEmail store error:", error);
          set({ isLoading: false, error: error.message || "An unknown error occurred while sending email." });
          throw error;
        }
      },
      updateEmailMetadata: (payload) => {
        set((state) => {
          const updatedEmails = state.emails.map((email) => {
            if (email.id === payload.email_id) {
              const newTopic = isValidEmailTopic(payload.topic) ? payload.topic : email.topic;
              return {
                ...email,
                topic: newTopic,
                priority: payload.priority ?? email.priority,
              };
            }
            return email;
          });
          return { emails: updatedEmails };
        });
      },
    }),
    {
      name: "email-store",
    },
  ),
);
