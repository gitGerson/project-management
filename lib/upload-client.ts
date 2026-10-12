'use client';

import { useState, useCallback, useRef } from 'react';

/**
 * Client-side utility for direct browser-to-S3 file uploads.
 * This ensures that large files are sent directly to S3 storage,
 * bypassing Next.js API routes and preventing server memory/bandwidth overhead.
 */

export interface DirectUploadOptions {
  folder?: string;
  onProgress?: (progress: { loaded: number; total: number; percentage: number }) => void;
  signal?: AbortSignal;
}

export interface DirectUploadResult {
  key: string;
  publicUrl: string;
  fileName: string;
  fileSize: number;
  contentType: string;
}

/**
 * Upload a File directly to S3 from the browser.
 */
export async function uploadFileDirectly(
  file: File,
  options: DirectUploadOptions = {}
): Promise<DirectUploadResult> {
  const { folder = 'uploads', onProgress, signal } = options;

  // Step 1: Request presigned upload URL from Next.js server
  const presignResponse = await fetch('/api/upload/presign', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      fileSize: file.size,
      folder,
    }),
    signal,
  });

  const presignData = await presignResponse.json();

  if (!presignResponse.ok || !presignData.success) {
    throw new Error(
      presignData.error || `Failed to initiate upload (Status ${presignResponse.status})`
    );
  }

  const { uploadUrl, key, publicUrl } = presignData.data;

  // Step 2: Upload file directly to S3 via PUT request
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (signal) {
      signal.addEventListener('abort', () => {
        xhr.abort();
        reject(new DOMException('Upload aborted', 'AbortError'));
      });
    }

    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentage = Math.round((event.loaded / event.total) * 100);
          onProgress({
            loaded: event.loaded,
            total: event.total,
            percentage,
          });
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(
          new Error(
            `Direct S3 upload failed with status ${xhr.status}: ${xhr.statusText || 'Check S3 CORS and bucket permissions.'}`
          )
        );
      }
    };

    xhr.onerror = () => {
      reject(
        new Error(
          'Network error during S3 upload. If using custom S3/MinIO, please ensure CORS (PUT, Content-Type) is allowed on the bucket.'
        )
      );
    };

    xhr.send(file);
  });

  return {
    key,
    publicUrl,
    fileName: file.name,
    fileSize: file.size,
    contentType: file.type || 'application/octet-stream',
  };
}

/**
 * Get temporary presigned preview or download URL for private S3 objects.
 */
export async function getPreviewUrl(
  key: string,
  options?: { download?: boolean; filename?: string }
): Promise<{ presignedUrl: string; publicUrl: string }> {
  const params = new URLSearchParams({ key });
  if (options?.download) params.set('download', 'true');
  if (options?.filename) params.set('filename', options.filename);

  const res = await fetch(`/api/upload/preview?${params.toString()}`);
  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to fetch preview URL');
  }

  return json.data;
}

/**
 * React hook for uploading files directly to S3 with reactive progress and cancellation.
 */
export function useDirectUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const upload = useCallback(async (file: File, options?: { folder?: string }) => {
    setIsUploading(true);
    setProgress(0);
    setError(null);
    abortControllerRef.current = new AbortController();

    try {
      const result = await uploadFileDirectly(file, {
        folder: options?.folder,
        signal: abortControllerRef.current.signal,
        onProgress: (p) => setProgress(p.percentage),
      });
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      throw err;
    } finally {
      setIsUploading(false);
    }
  }, []);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const reset = useCallback(() => {
    setIsUploading(false);
    setProgress(0);
    setError(null);
  }, []);

  return {
    upload,
    cancel,
    reset,
    isUploading,
    progress,
    error,
  };
}

