import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { openai } from "@/lib/openai";
import { Database } from "@/types/supabase";
import { getGoogleTokens } from "@/lib/google-token-utils";

type FileInsert = Database['public']['Tables']['files']['Insert'];

async function pollVectorStoreFileProcessing(
  vectorStoreId: string,
  fileId: string, // This is the OpenAI file ID
  timeoutMs: number = 120000, // 2 minutes
  intervalMs: number = 3000 // 3 seconds
): Promise<void> {
  const startTime = Date.now();
  console.log(`Starting polling for file ${fileId} in vector store ${vectorStoreId}. Timeout: ${timeoutMs/1000}s`);
  while (Date.now() - startTime < timeoutMs) {
    try {
      const vsFile = await openai.vectorStores.files.retrieve(vectorStoreId, fileId);
      console.log(`File ${fileId} in VS ${vectorStoreId} - Status: ${vsFile.status}`);
      if (vsFile.status === 'completed') {
        console.log(`File ${fileId} processing completed for vector store ${vectorStoreId}.`);
        return;
      }
      if (vsFile.status === 'failed' || vsFile.status === 'cancelled') {
        const errorMessage = vsFile.last_error?.message || "No specific error message provided.";
        console.error(`File ${fileId} processing ${vsFile.status} for vector store ${vectorStoreId}. Error: ${errorMessage}`);
        throw new Error(`File processing ${vsFile.status}. Error: ${errorMessage}`);
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    } catch (error: any) {
      console.error(`Error during polling for file ${fileId} in vector store ${vectorStoreId}:`, error.message);
      if (Date.now() - startTime >= timeoutMs) {
        throw new Error(`Timeout after ${timeoutMs / 1000}s waiting for file ${fileId} to process in vector store ${vectorStoreId}. Last error: ${error.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs)); 
    }
  }
  throw new Error(`Timeout after ${timeoutMs / 1000}s waiting for file ${fileId} to process in vector store ${vectorStoreId}.`);
}

async function coreFileProcessingAndStorage(
  fileBuffer: Buffer,
  originalFileName: string,
  mimeType: string,
  fileSize: number,
  userId: string,
  assistantDbId: string,
  supabaseServiceRoleClient: any 
) {
  console.log(`[CoreLogic] Starting processing for: ${originalFileName}, user: ${userId}, assistant: ${assistantDbId}`);
  
  const { data: assistantConfig, error: assistantFetchError } = await supabaseServiceRoleClient
    .from("assistants")
    .select("id, openai_assistant_id, openai_vector_store_id")
    .eq("id", assistantDbId)
    .single();

  if (assistantFetchError) {
    console.error(`[CoreLogic] Error fetching assistant config for ID ${assistantDbId}:`, assistantFetchError);
    throw new Error(`Failed to fetch assistant configuration: ${assistantFetchError.message}`);
  }
  if (!assistantConfig) {
    throw new Error(`Assistant configuration with ID ${assistantDbId} not found.`);
  }
  if (!assistantConfig.openai_assistant_id) {
     throw new Error(`Assistant ${assistantDbId} is missing OpenAI assistant ID.`);
  }
  if (!assistantConfig.openai_vector_store_id) {
    console.error(`[CoreLogic] CRITICAL: Assistant ${assistantDbId} (OpenAI ID: ${assistantConfig.openai_assistant_id}) is missing its dedicated openai_vector_store_id in the database.`);
    throw new Error(`Assistant ${assistantDbId} is missing its dedicated OpenAI vector store ID.`);
  }
  const dedicatedVectorStoreId = assistantConfig.openai_vector_store_id;
  console.log(`[CoreLogic] Using dedicated Vector Store ID: ${dedicatedVectorStoreId} for assistant ${assistantDbId}`);

  const sanitizedFilename = originalFileName.replace(/[^a-zA-Z0-9_\.\s\-]/g, '_').replace(/\s+/g, '_');
  const storagePath = `public/${userId}/${Date.now()}-${sanitizedFilename}`;
  const bucketName = 'files';

  const { data: storageData, error: storageError } = await supabaseServiceRoleClient.storage
    .from(bucketName)
    .upload(storagePath, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (storageError) {
    console.error("[CoreLogic] Supabase Storage upload error:", storageError);
    throw new Error(`Storage upload failed: ${storageError.message}`);
  }
  console.log(`[CoreLogic] File uploaded to Supabase Storage: ${storagePath}`, storageData);

  let openaiFileId: string | null = null;
  try {
    const blob = new Blob([fileBuffer], { type: mimeType });
    const openaiCompatibleFile = new File([blob], sanitizedFilename, { type: mimeType });

    console.log(`[CoreLogic] Uploading ${sanitizedFilename} to OpenAI...`);
    const openaiFileResponse = await openai.files.create({
      file: openaiCompatibleFile,
      purpose: "assistants",
    });
    openaiFileId = openaiFileResponse.id;
    console.log(`[CoreLogic] Successfully uploaded to OpenAI. File ID: ${openaiFileId}`);

    console.log(`[CoreLogic] Adding OpenAI file ${openaiFileId} to assistant's dedicated vector store ${dedicatedVectorStoreId}...`);
    await openai.vectorStores.files.create(dedicatedVectorStoreId, {
      file_id: openaiFileId,
    });
    console.log(`[CoreLogic] File ${openaiFileId} associated with vector store ${dedicatedVectorStoreId}. Polling for processing...`);
    await pollVectorStoreFileProcessing(dedicatedVectorStoreId, openaiFileId);
    console.log(`[CoreLogic] File ${openaiFileId} successfully processed in vector store ${dedicatedVectorStoreId}.`);
    
  } catch (oaiError: any) {
    console.error("[CoreLogic] OpenAI processing error:", oaiError);
    if (openaiFileId) {
      console.log(`[CoreLogic] Attempting to delete orphaned OpenAI file: ${openaiFileId}`);
      await openai.files.del(openaiFileId).catch(fileDelError => {
        console.error("[CoreLogic] Failed to delete orphaned OpenAI file:", fileDelError);
      });
    }
    if (storagePath) {
        console.log(`[CoreLogic] Attempting to delete file from Supabase storage due to OpenAI error: ${storagePath}`);
        await supabaseServiceRoleClient.storage.from(bucketName).remove([storagePath]).catch((s3DelErr: any) => {
            console.error("[CoreLogic] Failed to delete from Supabase storage during OpenAI error cleanup:", s3DelErr);
        });
    }
    throw new Error(`OpenAI processing failed: ${oaiError.message}`);
  }

  const fileMetadata: FileInsert = {
    user_id: userId,
    filename: sanitizedFilename,
    storage_path: storagePath,
    mime_type: mimeType,
    size_bytes: fileSize,
    openai_file_id: openaiFileId,
    openai_vector_store_id: dedicatedVectorStoreId,
  };

  const { data: dbData, error: dbError } = await supabaseServiceRoleClient
    .from('files')
    .insert(fileMetadata)
    .select('id')
    .single();

  if (dbError) {
    console.error("[CoreLogic] Supabase DB insert error:", dbError);
    if (storagePath) await supabaseServiceRoleClient.storage.from(bucketName).remove([storagePath]);
    if (openaiFileId && dedicatedVectorStoreId) {
      await openai.vectorStores.files.del(dedicatedVectorStoreId, openaiFileId).catch(err => console.warn('[CoreLogic] Cleanup: Failed to delete file from VS', err));
    }
    if (openaiFileId) {
      await openai.files.del(openaiFileId).catch(err => console.error('[CoreLogic] Cleanup: Failed to delete orphaned OpenAI file', err));
    }
    throw new Error(`Database insert failed: ${dbError.message}`);
  }

  console.log("[CoreLogic] File metadata inserted into DB. ID:", dbData.id);
  return { success: true, fileId: dbData.id };
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabaseAuth = createClient(cookieStore);
  const supabaseService = createServiceRoleClient();

  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
  if (authError || !user) {
    console.error('Auth Error in POST /api/upload:', authError);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = user.id;

  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await request.json();
      const { sourceType, driveFileId, fileName, assistantId: assistantDbId } = body;

      if (sourceType === 'googleDrive' && driveFileId && fileName && assistantDbId) {
        console.log(`Received Google Drive file upload request:`, { driveFileId, fileName, assistantDbId });
        
        const tokenData = await getGoogleAccessTokenForUser(userId, supabaseService);
        if (!tokenData || !tokenData.accessToken) {
          console.error(`No valid Google access token found for user ${userId}. Refresh might be needed.`);
          return NextResponse.json({ success: false, error: "Google authentication token not found or expired. Please reconnect Google Drive." }, { status: 403 });
        }
        const googleAccessToken = tokenData.accessToken;
        
        console.warn("Placeholder: Google Drive download not implemented. Using dummy data for now.");
        const { fileBuffer, actualMimeType, fileSize } = await downloadFromGoogleDrive(driveFileId, googleAccessToken);
        
        const result = await coreFileProcessingAndStorage(
          fileBuffer,
          fileName, 
          actualMimeType,
          fileSize,
          userId,
          assistantDbId,
          supabaseService 
        );
        return NextResponse.json(result);

      } else {
        return NextResponse.json({ success: false, error: "Invalid JSON payload for Google Drive upload." }, { status: 400 });
      }

    } else if (contentType.includes("multipart/form-data")) {
      const data = await request.formData();
      const file: File | null = data.get("file") as File;
      const assistantDbId = data.get("assistantId") as string;

      if (!file) {
        return NextResponse.json({ success: false, error: "No file provided." }, { status: 400 });
      }
      if (!assistantDbId) {
        return NextResponse.json({ success: false, error: "No assistantId (database UUID) provided." }, { status: 400 });
      }

      const fileBuffer = Buffer.from(await file.arrayBuffer());
      
      const result = await coreFileProcessingAndStorage(
        fileBuffer,
        file.name,
        file.type,
        file.size,
        userId,
        assistantDbId,
        supabaseService 
      );
      return NextResponse.json(result);

    } else {
      return NextResponse.json({ success: false, error: `Unsupported Content-Type: ${contentType}` }, { status: 415 });
  }
  } catch (error: any) {
    console.error("Error in POST /api/upload handling:", error);
    return NextResponse.json({ success: false, error: error.message || "An unknown error occurred" }, { status: 500 });
  }
}

async function getGoogleAccessTokenForUser(
  userId: string, 
  supabaseService: any
): Promise<{ accessToken: string | null; refreshToken: string | null }> {
  console.log(`Fetching Google tokens for user ${userId} using google-token-utils.`);
  try {
    const tokens = await getGoogleTokens(supabaseService, userId); 
    if (!tokens.accessToken) {
      console.warn(`Access token not found for user ${userId}.`);
    }
    return tokens;
  } catch (error: any) {
    console.error(`Error in getGoogleAccessTokenForUser for user ${userId}:`, error);
    return { accessToken: null, refreshToken: null };
  }
}

async function downloadFromGoogleDrive(driveFileId: string, accessToken: string): Promise<{fileBuffer: Buffer, actualMimeType: string, fileSize: number}> {
  console.warn(`TODO: Implement downloadFromGoogleDrive for file ${driveFileId}. Using dummy data for now.`);
  const dummyContent = Buffer.from(`dummy content for Google Drive file ${driveFileId}`);
  return { fileBuffer: dummyContent, actualMimeType: "text/plain", fileSize: dummyContent.length };
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get("file_id");

  const supabaseAuth = createClient(cookieStore);
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

  if (authError || !user) {
    console.error('Auth Error in GET /api/upload:', authError);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = user.id;

  const bucketName = 'files'; 

  if (fileId) {
    const supabaseService = createServiceRoleClient();

    const { data: fileRecord, error: dbFetchError } = await supabaseService
      .from('files')
      .select('storage_path, filename, mime_type')
      .eq('id', fileId)
      .eq('user_id', userId)
      .single();

    if (dbFetchError || !fileRecord) {
      console.error(`Error fetching file record ${fileId} for user ${userId}:`, dbFetchError);
      return NextResponse.json({ success: false, error: "File not found or access denied." }, { status: 404 });
    }

    const storagePath = fileRecord.storage_path;
    if (!storagePath) {
       console.error(`File record ${fileId} is missing storage_path.`);
       return NextResponse.json({ success: false, error: "File record incomplete." }, { status: 500 });
    }
    const { data: blob, error: downloadError } = await supabaseAuth.storage
        .from(bucketName)
        .download(storagePath);

    if (downloadError) {
        console.error(`Error downloading file ${storagePath} from storage:`, JSON.stringify(downloadError, null, 2));
        
        let errorMessage = "Failed to download file.";
        if (typeof downloadError.message === 'string' && downloadError.message.trim() !== '') {
            errorMessage = `Failed to download file: ${downloadError.message}`;
        } else if (typeof downloadError === 'string') {
            errorMessage = `Failed to download file: ${downloadError}`;
        } else if (downloadError.name) {
            errorMessage = `Failed to download file: ${downloadError.name}`;
        }
        else if (Object.keys(downloadError).length === 0 && downloadError.constructor === Object) {
            errorMessage = "Failed to download file: An unexpected empty error object was received.";
        }
        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }

    if (!blob) {
         console.error(`No blob data returned for file ${storagePath}`);
         return NextResponse.json({ success: false, error: "Failed to retrieve file data." }, { status: 500 });
    }

    console.log(`Successfully fetched file ${storagePath} for download.`);
    const headers = new Headers();
    headers.set('Content-Type', fileRecord.mime_type || 'application/octet-stream');
    headers.set('Content-Disposition', `attachment; filename="${fileRecord.filename || fileId}"`);

    return new NextResponse(blob, { status: 200, headers });

  } else {
    const { data: files, error: listError } = await supabaseAuth
      .from('files')
      .select('id, filename, size_bytes, mime_type, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (listError) {
      console.error(`Error listing files for user ${userId}:`, listError);
      return NextResponse.json({ success: false, error: `Failed to list files: ${listError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, files: files || [] });
  }
}

export async function DELETE(request: NextRequest) {
  const cookieStore = await cookies();
  const { searchParams } = new URL(request.url);
  const fileDbId = searchParams.get("file_id");

  if (!fileDbId) {
    return NextResponse.json({ success: false, error: "file_id query parameter is required" }, { status: 400 });
  }

  const supabaseAuth = createClient(cookieStore);
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

  if (authError || !user) {
    console.error('Auth Error in DELETE /api/upload:', authError);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = user.id;

  console.log(`Attempting to delete file record with DB ID: ${fileDbId} for user: ${userId}`);
  const supabaseService = createServiceRoleClient();
  const bucketName = 'files';

  const { data: fileRecord, error: dbFetchError } = await supabaseService
    .from('files')
    .select('id, storage_path, openai_file_id, openai_vector_store_id')
    .eq('id', fileDbId)
    .eq('user_id', userId) 
    .single();

  if (dbFetchError) {
    const errorMessage = dbFetchError.code === 'PGRST116' ? "File not found or access denied." : `Database fetch failed: ${dbFetchError.message}`;
    const errorStatus = dbFetchError.code === 'PGRST116' ? 404 : 500;
    console.error(`Error fetching file record ${fileDbId} for delete:`, dbFetchError);
    return NextResponse.json({ success: false, error: errorMessage }, { status: errorStatus });
  }
  if (!fileRecord) { 
    console.error(`File record ${fileDbId} not found for user ${userId}.`);
    return NextResponse.json({ success: false, error: "File not found or access denied." }, { status: 404 });
  }

  if (fileRecord.storage_path) {
    const { error: storageError } = await supabaseService.storage
      .from(bucketName)
      .remove([fileRecord.storage_path]);
    if (storageError) console.warn(`Failed to delete file ${fileRecord.storage_path} from Supabase storage:`, storageError);
    else console.log(`Successfully deleted file ${fileRecord.storage_path} from Supabase storage.`);
  } else console.warn(`File record ${fileDbId} had no storage_path. Skipping Supabase storage delete.`);

  if (fileRecord.openai_file_id && fileRecord.openai_vector_store_id) {
    console.log(`Attempting to delete OpenAI file ${fileRecord.openai_file_id} from vector store ${fileRecord.openai_vector_store_id}`);
    try {
      await openai.vectorStores.files.del(fileRecord.openai_vector_store_id, fileRecord.openai_file_id);
      console.log(`Successfully deleted OpenAI file ${fileRecord.openai_file_id} from vector store ${fileRecord.openai_vector_store_id}.`);
    } catch (vsFileDelError: any) {
        console.warn(`Failed to delete OpenAI file ${fileRecord.openai_file_id} from vector store ${fileRecord.openai_vector_store_id}:`, vsFileDelError);
    }
  } else {
    if (fileRecord.openai_vector_store_id) {
      console.warn(`File record ${fileDbId} has openai_vector_store_id but no openai_file_id. Cannot remove specific file from VS.`);
    }
  }
  
  if (fileRecord.openai_file_id) {
    console.log(`Attempting to delete OpenAI file object: ${fileRecord.openai_file_id}`);
    try {
      await openai.files.del(fileRecord.openai_file_id);
      console.log(`Successfully deleted OpenAI file object ${fileRecord.openai_file_id}.`);
    } catch (fileDelError: any) {
        console.warn(`Failed to delete OpenAI file object ${fileRecord.openai_file_id}:`, fileDelError);
    }
  }

  const { error: dbDeleteError } = await supabaseService
    .from('files')
    .delete()
    .eq('id', fileDbId); 

  if (dbDeleteError) {
    console.error(`Failed to delete file record ${fileDbId} from database:`, dbDeleteError);
    return NextResponse.json({ success: false, error: `Database delete failed: ${dbDeleteError.message}. External resources might have been cleaned.` }, { status: 500 });
  }

  console.log(`Successfully deleted file record ${fileDbId} from database and attempted cleanup of associated resources.`);
  return NextResponse.json({ success: true });
}
