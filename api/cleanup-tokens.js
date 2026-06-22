export default async function handler(req, res) {
  try {
    const { default: admin } = await import('firebase-admin');
    
    if (!admin.apps.length) {
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;
      if (privateKey && privateKey.includes('\\n')) {
        privateKey = privateKey.replace(/\\n/g, '\n');
      }
      
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
      });
    }
    
    const db = admin.firestore();
    const now = new Date();
    
    
    // Find expired or used tokens
    const tokensQuery = db.collection('passwordResetTokens')
      .where('expiresAt', '<', admin.firestore.Timestamp.fromDate(now));
    
    const tokensSnapshot = await tokensQuery.get();
    
    
    // Delete in batches to avoid quota issues
    const batch = db.batch();
    let deletedCount = 0;
    
    tokensSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
      
      // Commit every 100 deletes
      if (deletedCount % 100 === 0) {
        batch.commit();
      }
    });
    
    // Commit remaining
    if (tokensSnapshot.size % 100 !== 0) {
      await batch.commit();
    }
    
    
    res.status(200).json({
      success: true,
      deletedCount: deletedCount,
      timestamp: now.toISOString(),
      message: `Cleaned up ${deletedCount} expired tokens`
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code
    });
  }
}