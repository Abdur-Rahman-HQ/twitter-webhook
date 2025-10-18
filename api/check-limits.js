import { TwitterApi } from 'twitter-api-v2';

export default async function handler(req, res) {
  try {
    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY?.trim(),
      appSecret: process.env.TWITTER_API_SECRET?.trim(),
      accessToken: process.env.TWITTER_ACCESS_TOKEN?.trim(),
      accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET?.trim(),
    });
    
    const rateLimitStatus = await client.v1.rateLimitStatuses();
    
    return res.status(200).json({
      success: true,
      limits: rateLimitStatus
    });
    
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
