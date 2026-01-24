export default async function handler(req, res) {
  try {
    // Check environment
    const env = {
      NODE_ENV: process.env.NODE_ENV,
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID?.substring(0, 10) + '...',
      FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL?.substring(0, 10) + '...',
      HAS_PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY
    };
    
    // Analyze potential quota issues
    const analysis = {
      timestamp: new Date().toISOString(),
      environment: env,
      potentialIssues: [],
      recommendations: []
    };
    
    // Common quota issues
    if (process.env.NODE_ENV === 'development') {
      analysis.potentialIssues.push(
        'Development environment - frequent resets during testing',
        'Token cleanup might not be implemented'
      );
    }
    
    // Check if tokens are being cleaned up
    analysis.recommendations.push(
      '1. Implement token cleanup (delete used/expired tokens)',
      '2. Add rate limiting to password reset requests',
      '3. Cache office data to reduce reads',
      '4. Use memory store for tokens in development',
      '5. Monitor Firebase Console → Usage tab'
    );
    
    // Check recent activity
    const recentActivity = [];
    try {
      // You could add recent activity logging here
      analysis.recentActivity = 'Activity logging not implemented';
    } catch (error) {
      analysis.recentActivityError = error.message;
    }
    
    res.status(200).json(analysis);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}