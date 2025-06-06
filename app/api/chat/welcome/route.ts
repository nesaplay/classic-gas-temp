import { NextResponse } from "next/server";
import { createServiceRoleClient, createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { Database } from '@/types/supabase';

type Thread = Database['public']['Tables']['threads']['Row'];
type Message = Database['public']['Tables']['messages']['Row'];
type Assistant = Database['public']['Tables']['assistants']['Row'];

export async function POST(request: Request) {
    const cookieStore = await cookies();
    let requestData;

    try {
        requestData = await request.json();
    } catch (e) {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { assistantId } = requestData;

    if (!assistantId) {
        return NextResponse.json({ error: "Missing required field: assistantId" }, { status: 400 });
    }

    // --- Authentication ---
    const supabaseAuth = createClient(cookieStore);
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
        console.error('Auth Error in POST /api/chat/welcome:', authError);
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = user.id;
    // --- End Authentication ---

    const supabaseService = createServiceRoleClient();

    try {
        // 0. Fetch Assistant's Welcome Message
        const { data: assistantData, error: assistantError } = await supabaseService
            .from('assistants')
            .select('welcome_message')
            .eq('id', assistantId)
            .single();

        if (assistantError || !assistantData) {
             console.error(`Assistant fetch error for ID ${assistantId}:`, assistantError);
             return NextResponse.json({ error: `Failed to fetch assistant details: ${assistantError?.message || 'Assistant not found'}` }, { status: 404 });
        }

        // TODO: Re-using old assistant, with new welcome message
        const welcomeMessage = ["I am your personal assistant, How can I help you today?"];
        if (!welcomeMessage || !Array.isArray(welcomeMessage) || welcomeMessage.length === 0) {
            console.warn(`Assistant ${assistantId} has no welcome message configured or it's not a string array.`);
            return NextResponse.json({ error: `Assistant ${assistantId} does not have a valid welcome message configured.` }, { status: 400 });
        }

        // 1. Create the new thread
        const { data: newThread, error: threadError } = await supabaseService
            .from('threads')
            .insert({
                user_id: userId,
                assistant_id: assistantId,
                title: 'Email Management'
            })
            .select()
            .single();

        if (threadError || !newThread) {
            console.error("Supabase create thread error:", threadError);
            return NextResponse.json({ error: `Failed to create thread: ${threadError?.message || 'Unknown error'}` }, { status: 500 });
        }

        console.log({newThread})

        // 2. Insert the fetched welcome message
        const messageToInsert = {
            thread_id: newThread.id,
            user_id: null,
            assistant_id: assistantId,
            role: "assistant" as const,
            content: welcomeMessage[0],
            completed: true,
            metadata: null,
        };

        console.log({messageToInsert})

        const { data: newMessage, error: messageError } = await supabaseService
            .from("messages")
            .insert(messageToInsert)
            .select()
            .single();

        if (messageError || !newMessage) {
            console.error("Supabase insert welcome message error:", messageError);
            return NextResponse.json({ error: `Failed to save welcome message: ${messageError?.message || 'Unknown error'}` }, { status: 500 });
        }

        // Return both the new thread and the message
        return NextResponse.json({ thread: newThread as Thread, message: newMessage as Message }, { status: 201 });

    } catch (error: any) {
        console.error("Unexpected POST /api/chat/welcome error:", error);
        return NextResponse.json({ error: "An unexpected error occurred during welcome setup" }, { status: 500 });
    }
} 