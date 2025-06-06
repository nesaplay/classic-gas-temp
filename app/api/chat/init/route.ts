import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { Database } from '@/types/supabase';

type Message = Database['public']['Tables']['messages']['Row'];
type Thread = Pick<
    Database['public']['Tables']['threads']['Row'],
    'id' | 'title' | 'updated_at' | 'assistant_id' | 'created_at'
>;

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const { searchParams } = new URL(request.url);
  const assistantId = searchParams.get("assistantId");

  if (!assistantId) {
    return NextResponse.json({ error: "assistantId query parameter is required" }, { status: 400 });
  }

  // --- Authentication ---
  const supabaseAuth = createClient(cookieStore);
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

  if (authError || !user) {
    console.error('Auth Error in GET /api/chat/init:', authError);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = user.id;
  // --- End Authentication ---

  console.log(`GET Init: Fetching threads for assistant ${assistantId} and user ${userId}`);
  const supabaseService = createServiceRoleClient();

  try {
    // 1. Fetch all threads for the user & assistant, ordered by latest update
    const { data: threadsData, error: threadsError } = await supabaseService
      .from('threads')
      .select('id, title, updated_at, assistant_id, created_at')
      .eq('user_id', userId)
      .eq('assistant_id', assistantId)
      .order('updated_at', { ascending: false });

    if (threadsError) {
      console.error("Supabase GET threads error:", threadsError);
      return NextResponse.json({ error: `Failed to fetch threads: ${threadsError.message}` }, { status: 500 });
    }

    const threads = (threadsData || []) as Thread[];
    let messagesForLatestThread: Message[] = [];

    // 2. If threads exist, fetch messages for the most recent one
    if (threads.length > 0) {
      const latestThreadId = threads[0].id;
      console.log(`GET Init: Found ${threads.length} threads, fetching messages for latest: ${latestThreadId}`);
      const { data: messagesData, error: messagesError } = await supabaseService
        .from('messages')
        .select('*')
        .eq('thread_id', latestThreadId)
        .order('created_at', { ascending: true });

      if (messagesError) {
        console.error("Supabase GET latest messages error:", messagesError);
        // Don't fail the whole request, just return empty messages for this thread
      } else {
          messagesForLatestThread = (messagesData || []) as Message[];
      }
    } else {
        console.log(`GET Init: No threads found for assistant ${assistantId} and user ${userId}`);
    }

    // Return both threads and the messages for the latest thread
    return NextResponse.json({ threads: threads, messages: messagesForLatestThread });

  } catch (error: any) {
    console.error("Unexpected GET /api/chat/init error:", error);
    return NextResponse.json({ error: "An unexpected error occurred during initialization" }, { status: 500 });
  }
} 