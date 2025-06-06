import { google } from "googleapis";
import { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { updateGoogleTokens, getGoogleTokens } from "./google-token-utils"; // Assuming this is the path
import { createClient } from "@/lib/supabase/server"; // For server-side Supabase client

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export async function getGmailClient(cookieStore: ReadonlyRequestCookies, userId?: string) {
  let accessToken = cookieStore.get("gmail_access_token")?.value;
  const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

  if (!accessToken && userId) {
    // Try to get from DB if not in cookies (e.g., if cookies were cleared but DB has tokens)
    // This requires userId to be passed, which might not always be available here.
    // Consider if this logic is desired or if missing cookie token should always mean re-auth.
    console.log(`Access token missing from cookies for user ${userId}, trying DB.`);
    const supabase = createClient(cookieStore); // Create a temporary Supabase client
    const dbTokens = await getGoogleTokens(supabase, userId);
    if (dbTokens.accessToken) {
      console.log(`Access token found in DB for user ${userId}`);
      accessToken = dbTokens.accessToken;
      // Optionally set cookie here if found in DB but not in cookie
      // cookieStore.set("gmail_access_token", dbTokens.accessToken, { ...cookieOptions });
    } else {
      console.log(`Access token not found in DB for user ${userId} either.`);
      return null; // No access token in cookies or DB
    }
  }

  if (!accessToken) {
    console.log("No access token available to initialize Gmail client.");
    return null;
  }

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken, // refreshToken can be undefined if not available
  });

  try {
    // Check if the token is expired by trying to get token info or by just trying to refresh
    // A more robust way is to attempt a lightweight API call or decode the token to check expiry.
    // For now, let's rely on refreshAccessToken to handle it.
    const tokenInfo = await oauth2Client.getTokenInfo(accessToken).catch(() => null);

    if (!tokenInfo) { // Token might be invalid or expired
        console.log("Current access token is invalid or expired. Attempting to refresh.");
        if (!refreshToken) {
            console.error("No refresh token available. Cannot refresh access token.");
            return null; // Cannot refresh, and current token is bad
        }
        const { credentials, res } = await oauth2Client.refreshAccessToken();
        
        if (credentials.access_token) {
            console.log("Access token refreshed successfully.");
            oauth2Client.setCredentials(credentials);
            // Update the access token in cookies
            cookieStore.set("gmail_access_token", credentials.access_token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                path: "/",
            });
            // Also update in DB if userId is available and you have a Supabase client
            if (userId) {
                const supabase = createClient(cookieStore); // Create Supabase client if needed
                await updateGoogleTokens(supabase, userId, { access_token: credentials.access_token, refresh_token: credentials.refresh_token });
            }
        } else {
            console.error("Failed to refresh access token. No new access token received.");
            // This case means refresh attempt failed critically
            return null; 
        }
    }
    return google.gmail({ version: "v1", auth: oauth2Client });
  } catch (error: any) {
    console.error("Error during Gmail client setup or token refresh:", error.message);
    // If the error is specifically an invalid_grant, it often means the refresh token is bad
    if (error.response?.data?.error === 'invalid_grant') {
        console.error("Invalid grant: Refresh token is likely invalid. User needs to re-authenticate.");
        // Optionally, clear tokens from DB and cookies here if userId is available
    }
    return null; // Return null on any error during this sensitive setup
  }
} 