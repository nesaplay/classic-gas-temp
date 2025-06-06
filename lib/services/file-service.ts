import { Database } from "@/types/supabase";

type FileMetadata = Pick<
  Database["public"]["Tables"]["files"]["Row"],
  "id" | "filename" | "size_bytes" | "mime_type" | "created_at"
>;

export class FileService {
  /**
   * Fetches a file blob from the backend API using its database ID.
   * @param fileId The ID of the file record in the database.
   * @returns A File object.
   */
  static async fetchFile(fileId: string): Promise<File> {
    const response = await fetch(`/api/upload?file_id=${fileId}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})); // Try to parse error, default to empty object
      throw new Error(
        `Failed to fetch file ${fileId}: ${response.status} ${response.statusText} - ${
          errorData?.error || "Unknown error"
        }`,
      );
    }

    const blob = await response.blob();

    // Extract filename and type from headers if possible, otherwise use defaults
    const contentDisposition = response.headers.get("Content-Disposition");
    let filename = `downloaded_file_${fileId}`; // Default filename
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?([^;"]+)"?/i);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1];
      }
    }
    const contentType = response.headers.get("Content-Type") || "application/octet-stream";

    return new File([blob], filename, {
      type: contentType,
      // lastModified can't be reliably determined from response headers
    });
  }

  /**
   * Uploads a file to the backend API.
   * @param file The File object to upload.
   * @returns An object indicating success and the database ID of the new file record.
   */
  static async uploadFile(file: File): Promise<{ success: boolean; fileId: string; error?: string }> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(`File upload failed: ${result?.error || response.statusText || "Unknown error"}`);
    }
    return result; // Expects { success: boolean, fileId: string }
  }

  /**
   * Lists files available for the current user from the backend API.
   * @returns A promise resolving to an array of file metadata objects.
   */
  static async listFiles(): Promise<FileMetadata[]> {
    const response = await fetch("/api/upload"); // GET request without params lists files
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(`Failed to list files: ${result?.error || response.statusText || "Unknown error"}`);
    }
    return result.files as FileMetadata[];
  }

  /**
   * Deletes a file via the backend API using its database ID.
   * @param fileId The ID of the file record in the database.
   * @returns An object indicating success.
   */
  static async deleteFile(fileId: string): Promise<{ success: boolean; error?: string }> {
    const response = await fetch(`/api/upload?file_id=${fileId}`, {
      method: "DELETE",
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(`File deletion failed: ${result?.error || response.statusText || "Unknown error"}`);
    }
    return result; // Expects { success: boolean }
  }
}
