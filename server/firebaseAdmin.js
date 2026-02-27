const getSanitizedPrivateKey = () => {
  const key = process.env.FIREBASE_PRIVATE_KEY;
  if (!key) return null;
  return key.includes("\\n") ? key.replace(/\\n/g, "\n") : key;
};

export const getAdmin = async () => {
  const { default: admin } = await import("firebase-admin");

  if (!admin.apps.length) {
    const privateKey = getSanitizedPrivateKey();

    if (
      !process.env.FIREBASE_PROJECT_ID ||
      !process.env.FIREBASE_CLIENT_EMAIL ||
      !privateKey
    ) {
      throw new Error("Firebase Admin environment variables are not configured.");
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
  }

  return admin;
};
