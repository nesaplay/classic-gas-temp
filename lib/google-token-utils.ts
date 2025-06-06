import { SupabaseClient } from "@supabase/supabase-js";
import { encryptToken, decryptToken } from "@/lib/token-encryption";
import { DB_TABLES } from "@/lib/constants";

export async function getGoogleTokens(supabase: SupabaseClient, userId: string): Promise<{ accessToken: string | null; refreshToken: string | null }> {
  console.log(`Attempting to fetch tokens for user ${userId} from ${DB_TABLES.USER_GOOGLE_TOKENS}`);
  const { data, error } = await supabase
    .from(DB_TABLES.USER_GOOGLE_TOKENS)
    .select('encrypted_access_token, encrypted_refresh_token')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error(`Error fetching tokens from ${DB_TABLES.USER_GOOGLE_TOKENS}:`, error);
    return { accessToken: null, refreshToken: null };
  }

  if (!data) {
     console.log(`No tokens found for user ${userId} in ${DB_TABLES.USER_GOOGLE_TOKENS}`);
     return { accessToken: null, refreshToken: null };
  }

  console.log(`Tokens fetched for user ${userId}, attempting decryption...`);
  // Ensure data.encrypted_access_token and data.encrypted_refresh_token are not null before decrypting
  const accessToken = data.encrypted_access_token ? decryptToken(data.encrypted_access_token) : null;
  const refreshToken = data.encrypted_refresh_token ? decryptToken(data.encrypted_refresh_token) : null;

  return { accessToken, refreshToken };
}

export async function updateGoogleTokens(supabase: SupabaseClient, userId: string, tokens: { access_token?: string | null; refresh_token?: string | null }): Promise<void> {
  console.log(`Attempting to update tokens for user ${userId} in ${DB_TABLES.USER_GOOGLE_TOKENS}`);
  const updates: { [key: string]: string | null | Date } = {
     updated_at: new Date().toISOString() // Use ISO string for consistency
  };

  if (tokens.access_token) {
    updates.encrypted_access_token = encryptToken(tokens.access_token);
  }
  // Only update refresh token if a new one is provided by Google
  // (Google often only returns a refresh token on the initial authorization)
  if (tokens.refresh_token) { 
    updates.encrypted_refresh_token = encryptToken(tokens.refresh_token);
  }

   // Check if there's anything to update other than 'updated_at'
   if (Object.keys(updates).length === 1 && 'updated_at' in updates && !tokens.access_token && !tokens.refresh_token) {
     console.log(`No new token values provided to update for user ${userId}, only updating timestamp.`);
     // If you still want to update just the timestamp even if no new tokens, remove this block.
     // Otherwise, if only timestamp would be updated because no new tokens were passed,
     // we might not need to make this DB call unless we always want to bump updated_at.
     // For now, let's assume we only proceed if there are actual token changes.
   }
   
   if (!updates.encrypted_access_token && !updates.encrypted_refresh_token) {
     console.log(`No new access or refresh tokens provided to update for user ${userId}. Timestamp will be updated if other conditions met.`);
     // If you want to prevent updating just the timestamp if no tokens changed, you could return here.
     // However, the original logic would proceed to update the timestamp regardless.
     // Let's ensure at least one token is being updated or it's a new record scenario.
     // The original check was: if (!updates.encrypted_access_token && !updates.encrypted_refresh_token) return;
     // This should be: if we ONLY have updated_at and no new tokens, decide.
     // Given the original code, it updated `updated_at` regardless.
     // To ensure we actually have tokens to update if this isn't an initial save:
     if (!tokens.access_token && !tokens.refresh_token) {
        console.log(`No actual token values to update for user ${userId}. Only timestamp would be updated.`);
        // If you want to avoid DB write just for timestamp when no tokens changed: return;
     }
   }


  const { error } = await supabase
    .from(DB_TABLES.USER_GOOGLE_TOKENS)
    .update(updates)
    .eq('user_id', userId);

  if (error) {
    console.error(`Error updating tokens in ${DB_TABLES.USER_GOOGLE_TOKENS}:`, error);
  } else {
     console.log(`Successfully updated tokens for user ${userId}`);
  }
} 