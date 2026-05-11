import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { initializeFirebase } from './index';

/**
 * Uploads a file to Firebase Storage and returns the download URL.
 * @param file The file to upload
 * @param path The path in storage (e.g., 'daily-postings/userId/filename')
 * @returns Promise resolving to the download URL
 */
export async function uploadFile(file: File, path: string): Promise<string> {
    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Upload timed out (30s). This is likely a CORS or connection issue.')), 30000);
    });

    try {
        console.log('storage.ts: Initializing Firebase SDKs...');
        const { storage } = initializeFirebase();
        const storageRef = ref(storage, path);

        console.log('storage.ts: Starting upload with 30s timeout protection...');
        
        // Race the upload against the timeout
        const uploadPromise = (async () => {
            const result = await uploadBytes(storageRef, file);
            console.log('storage.ts: uploadBytes finished.');
            return await getDownloadURL(storageRef);
        })();

        const url = await Promise.race([uploadPromise, timeoutPromise]) as string;
        console.log('storage.ts: Upload/URL fetched successfully.');
        return url;
    } catch (error: any) {
        // Silent error to prevent Next.js development overlay
        console.warn('storage.ts: Upload failed or timed out:', error.message);
        return ""; // Return empty string so the caller knows it failed but can continue
    }
}
