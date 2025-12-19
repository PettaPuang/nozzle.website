import { del } from "@vercel/blob";

/**
 * Delete a file from Vercel Blob Storage
 * @param url - The URL of the blob to delete
 */
export async function deleteBlob(url: string) {
  try {
    // Extract pathname from URL
    // Vercel Blob URLs format: https://[hash].public.blob.vercel-storage.com/[pathname]
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.substring(1); // Remove leading slash

    await del(pathname);
    return { success: true };
  } catch (error) {
    console.error("Delete blob error:", error);
    return { success: false, error };
  }
}

/**
 * Extract pathname from Vercel Blob URL
 * @param url - The Vercel Blob URL
 * @returns The pathname or null if invalid URL
 */
export function extractBlobPathname(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.substring(1); // Remove leading slash
  } catch {
    return null;
  }
}

