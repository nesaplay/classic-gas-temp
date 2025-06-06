interface ProjectConfig {
  appName: string;
  chatIconUrl: string;
  assistants: {
    [key: string]: string;
  }[];
  sections: {
    id: string;
    assistantId: string;
  }[];
}

export const PROJECT_CONFIG: ProjectConfig = JSON.parse(process.env.NEXT_PUBLIC_PROJECT_CONFIG || "{}");

if (!PROJECT_CONFIG) {
  throw new Error("Project Config is not set. Please set the NEXT_PUBLIC_CONFIG environment variable.");
}

if (!PROJECT_CONFIG.assistants) {
  throw new Error("Assistants are not set. Please set the {assistants} in NEXT_PUBLIC_PROJECT_CONFIG environment variable.");
}

export const API_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

export const DB_TABLES = {
  USER_GOOGLE_TOKENS: "user_google_tokens",
  EMAIL_METADATA: "email_metadata",
  ASSISTANTS: "assistants",
} as const;
