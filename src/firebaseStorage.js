import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

export async function uploadPhoto(base64DataUrl) {
  // Convert base64 data URL to Blob
  const response = await fetch(base64DataUrl);
  const blob = await response.blob();

  // Generate unique filename
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const filename = `cooking-photos/${timestamp}-${randomStr}.jpg`;

  // Upload to Firebase Storage
  const storageRef = ref(storage, filename);
  await uploadBytes(storageRef, blob);

  // Return the download URL
  return getDownloadURL(storageRef);
}
