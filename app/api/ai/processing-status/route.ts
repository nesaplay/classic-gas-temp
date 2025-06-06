import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!jobId) {
    return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
  }

  try {
    const { data: job, error: jobError } = await supabase
      .from('ai_processing_jobs')
      .select('status, processed_emails, total_emails, error_message')
      .eq('id', jobId)
      .eq('user_id', user.id) // Ensure user can only access their own jobs
      .single();

    if (jobError) {
      if (jobError.code === 'PGRST116') { // PostgREST error code for "Not a single row was found"
        return NextResponse.json({ error: 'Job not found or access denied' }, { status: 404 });
      }
      console.error(`[API /ai/processing-status] Error fetching job ${jobId} for user ${user.id}:`, jobError);
      return NextResponse.json({ error: 'Failed to fetch job status', details: jobError.message }, { status: 500 });
    }

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json(job);

  } catch (error: any) {
    console.error(`[API /ai/processing-status] Unexpected error for job ${jobId}:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
} 