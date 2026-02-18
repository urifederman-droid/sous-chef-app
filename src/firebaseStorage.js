export async function uploadPhoto(base64DataUrl) {
  const bucket = process.env.REACT_APP_FIREBASE_STORAGE_BUCKET;

  // Generate unique filename
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const filename = `cooking-photos/${timestamp}-${randomStr}.jpg`;

  // Convert base64 to blob
  const res = await fetch(base64DataUrl);
  const blob = await res.blob();

  // Upload via Firebase Storage REST API
  const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(filename)}`;
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': blob.type || 'image/jpeg' },
    body: blob,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Upload failed (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(data.name)}?alt=media&token=${data.downloadTokens}`;
}
