export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const debugInfo = {
    environment: {
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
      FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
      FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? 
        `Present (${process.env.FIREBASE_PRIVATE_KEY.length} chars)` : 'Missing',
      FIREBASE_PRIVATE_KEY_START: process.env.FIREBASE_PRIVATE_KEY?.substring(0, 50),
      FIREBASE_PRIVATE_KEY_END: process.env.FIREBASE_PRIVATE_KEY?.substring(
        process.env.FIREBASE_PRIVATE_KEY?.length - 50
      ),
      HAS_NEWLINES: process.env.FIREBASE_PRIVATE_KEY?.includes('\n') ? 'YES' : 'NO',
      HAS_ESCAPED_NEWLINES: process.env.FIREBASE_PRIVATE_KEY?.includes('\\n') ? 'YES' : 'NO'
    },
    timestamp: new Date().toISOString()
  };
  
  // Try to initialize firebase-admin
  try {
    const admin = await import('firebase-admin');
    
    let formattedKey = process.env.FIREBASE_PRIVATE_KEY;
    if (formattedKey?.includes('\\n')) {
      formattedKey = formattedKey.replace(/\\n/g, '\n');
    }
    
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: formattedKey,
      }),
    });
    
    debugInfo.firebaseAdmin = 'Initialization successful';
    debugInfo.appsCount = admin.apps.length;
    
  } catch (error) {
    debugInfo.firebaseAdmin = `ERROR: ${error.message}`;
    debugInfo.errorDetails = {
      code: error.code,
      details: error.details
    };
  }
  
  return res.status(200).json(debugInfo);
}