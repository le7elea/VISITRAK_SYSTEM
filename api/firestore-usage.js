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
    
    // Get counts for each collection
    const collections = ['passwordResetTokens', 'visitors', 'offices', 'activityLogs'];
    const counts = {};
    
    for (const collectionName of collections) {
      try {
        const snapshot = await db.collection(collectionName).count().get();
        counts[collectionName] = snapshot.data().count;
      } catch (error) {
        counts[collectionName] = `Error: ${error.message}`;
      }
    }
    
    // Get recent password reset tokens
    const recentTokens = [];
    try {
      const tokensSnapshot = await db.collection('passwordResetTokens')
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();
      
      tokensSnapshot.forEach(doc => {
        const data = doc.data();
        recentTokens.push({
          id: doc.id,
          email: data.email,
          createdAt: data.createdAt?.toDate()?.toISOString(),
          expiresAt: data.expiresAt?.toDate()?.toISOString(),
          used: data.used
        });
      });
    } catch (error) {
      recentTokens.push({ error: error.message });
    }
    
    res.status(200).json({
      timestamp: new Date().toISOString(),
      collectionCounts: counts,
      recentPasswordResetTokens: recentTokens,
      totalTokens: counts.passwordResetTokens || 0,
      usageWarning: counts.passwordResetTokens > 100 ? 
        `High token count: ${counts.passwordResetTokens}. Consider cleanup.` : 'OK'
    });
    
  } catch (error) {
    console.error('Usage check error:', error);
    res.status(500).json({
      error: error.message,
      env: {
        hasFirebase: !!(process.env.FIREBASE_PRIVATE_KEY && 
                       process.env.FIREBASE_CLIENT_EMAIL && 
                       process.env.FIREBASE_PROJECT_ID)
      }
    });
  }
}