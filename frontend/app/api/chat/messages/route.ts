import { NextResponse } from "next/server";
import { createServiceRoleClient, createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { Database } from '@/types/supabase';

type Message = Database['public']['Tables']['messages']['Row'];

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const { searchParams } = new URL(request.url);
  const threadId = searchParams.get("thread_id");

  if (!threadId) {
    return NextResponse.json({ error: "thread_id query parameter is required" }, { status: 400 });
  }

  // --- Authentication ---
  const supabaseAuth = createClient(cookieStore);
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

  if (authError || !user) {
    console.error('Auth Error in GET /api/chat/messages:', authError);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = user.id;
  // --- End Authentication ---

  // Use service client for DB access, relying on explicit user_id checks or RLS
  const supabaseService = createServiceRoleClient();

  try {
    // --- Standard Mode: Fetch messages for a specific thread ---
    console.log(`GET: Fetching messages for thread ${threadId}`);

    // Fetch messages. Ensure thread belongs to user via RLS or explicit check.
    const { data: messages, error } = await supabaseService
      .from('messages')
      .select('*')
      .eq('thread_id', threadId)
      // Optional: Add check for thread ownership if needed
      // .eq((queryBuilder) => queryBuilder.from('threads').select('user_id').eq('id', threadId), userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error("Supabase GET messages error:", error);
      return NextResponse.json({ error: `Failed to fetch messages: ${error.message}` }, { status: 500 });
    }

    // Optionally check if thread itself exists for the user to return 404 if threadId is invalid/unauthorized
    // if (!messages) { ... check thread existence ... }

    return NextResponse.json({ messages: (messages || []) as Message[] });

  } catch (error: any) {
    console.error("Unexpected GET /api/chat/messages error:", error);
    return NextResponse.json({ error: "An unexpected error occurred while fetching messages" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const cookieStore = await cookies(); // Await the call to satisfy the type checker
  let messageData;

  try {
    messageData = await request.json();
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { content, thread_id } = messageData;

  if (!content || !thread_id) {
    return NextResponse.json({ error: "Missing required fields: content, thread_id" }, { status: 400 });
  }

  // --- Authentication and User ID Retrieval ---
  // Create client using the cookie store from the request
  const supabaseAuth = createClient(cookieStore);
  const {
    data: { user },
    error: authError,
  } = await supabaseAuth.auth.getUser();

  if (authError || !user) {
    console.error("Auth Error in POST /api/chat/messages:", authError);
    return NextResponse.json({ error: "Unauthorized - User not found" }, { status: 401 });
  }
  const userId = user.id;
  // --- End Authentication ---

  // --- Use Service Role for DB Write ---
  // Use the service role client for the actual database insertion
  const supabaseService = createServiceRoleClient();

  try {
    const messageToInsert = {
      thread_id: thread_id,
      user_id: userId,
      assistant_id: null,
      role: "user" as const,
      content: content,
      completed: true,
      metadata: messageData.metadata || null,
    };

    const { data: newMessage, error } = await supabaseService
      .from("messages")
      .insert(messageToInsert)
      .select()
      .single();

    if (error) {
      console.error("Supabase POST message error:", error);
      if (error.code === "23503") {
        return NextResponse.json({ error: `Invalid thread_id: ${thread_id}` }, { status: 400 });
      }
      return NextResponse.json({ error: `Failed to save message: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json(newMessage as Message, { status: 201 });
  } catch (error: any) {
    console.error("Unexpected POST message error:", error);
    return NextResponse.json({ error: "An unexpected error occurred while saving the message" }, { status: 500 });
  }
}
