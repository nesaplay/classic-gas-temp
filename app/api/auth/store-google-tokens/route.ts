import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { encryptToken } from '@/lib/token-encryption';
import { DB_TABLES } from '@/lib/constants';
import { Database } from '@/types/supabase';

export async function POST(request: Request) {
  console.log("[API /store-google-tokens] POST request received.");
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // --- Authenticate the user making the request --- 
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("[API /store-google-tokens] Auth Error:", userError?.message || "User not found");
    return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
  }
  console.log(`[API /store-google-tokens] User authenticated: ${user.id}`);

  // --- Get tokens from the request body --- 
  let provider_token: string | undefined;
  let provider_refresh_token: string | undefined;

  try {
    const body = await request.json();
    provider_token = body.provider_token;
    provider_refresh_token = body.provider_refresh_token; // This should be the one from session.refresh_token on client

    // --- MODIFIED VALIDATION --- 
    // Only require the access token strictly.
    if (!provider_token) { 
      throw new Error("Provider token (access token) missing in request body.");
    }
    // Log presence of refresh token for debugging
    if (provider_refresh_token) {
         console.log("[API /store-google-tokens] Received provider_refresh_token: present");
    } else {
         console.log("[API /store-google-tokens] provider_refresh_token: NOT present in request");
    }
     console.log("[API /store-google-tokens] Received provider_token (first 5 chars):", provider_token.substring(0, 5));
     // console.log("[API /store-google-tokens] Received provider_refresh_token: present"); // Removed old mandatory log

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Invalid request body';
    console.error("[API /store-google-tokens] Error parsing request body or tokens missing:", errorMessage);
    return NextResponse.json({ error: `Invalid request: ${errorMessage}` }, { status: 400 });
  }
  
  // --- Encrypt and store tokens --- 
  try {
    console.log(`[API /store-google-tokens] Attempting to encrypt and store tokens for user: ${user.id}`);
    const encryptedAccessToken = encryptToken(provider_token);
    const encryptedRefreshToken = encryptToken(provider_refresh_token);

    // Check if encryption failed 
    if (!encryptedAccessToken || !encryptedRefreshToken) {
        console.error('[API /store-google-tokens] Encryption failed for one or both tokens for user:', user.id);
        return NextResponse.json({ error: 'Failed to prepare tokens for storage' }, { status: 500 });
    }
    console.log(`[API /store-google-tokens] Tokens encrypted successfully for user: ${user.id}`);

    const dataToUpsert: Database['public']['Tables']['user_google_tokens']['Insert'] = {
        user_id: user.id,
        encrypted_access_token: encryptedAccessToken,
        provider: 'google',
        updated_at: new Date().toISOString(),
    }
    
    // This part correctly handles the optional refresh token
    if (provider_refresh_token && encryptedRefreshToken) {
        dataToUpsert.encrypted_refresh_token = encryptedRefreshToken;
        console.log(`[API /store-google-tokens] Including updated refresh token in upsert for user: ${user.id}`);
    } else {
        console.log(`[API /store-google-tokens] No new refresh token provided or encryption failed; refresh token will NOT be updated in DB for user: ${user.id}`);
    }

  // --- Upsert into database ---
    const { error: upsertError } = await supabase
      .from("user_google_tokens")
      .upsert(dataToUpsert, { onConflict: 'user_id, provider' });

    if (upsertError) {
      console.error("[API /store-google-tokens] DB Upsert Error for user:", user.id, upsertError);
      return NextResponse.json({ error: 'Failed to store tokens in database', details: upsertError.message }, { status: 500 });
    }

    console.log(`[API /store-google-tokens] Successfully stored/updated tokens for user: ${user.id}`);
    return NextResponse.json({ message: 'Tokens stored successfully' });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown server error';
    console.error("[API /store-google-tokens] Server error during token encryption or storage for user:", user.id, errorMessage);
    return NextResponse.json({ error: 'Internal server error', details: errorMessage }, { status: 500 });
  }
} 