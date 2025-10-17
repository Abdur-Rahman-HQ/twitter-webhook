import { TwitterApi } from 'twitter-api-v2';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { text, reply_to, reply, media_ids } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }
    
    console.log('Received request:', { text, reply_to, reply, media_ids });
    
    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
    });

    // Build tweet options
    const tweetOptions = {};
    
    // Handle reply - support both formats
    if (reply && reply.in_reply_to_tweet_id) {
      tweetOptions.reply = { in_reply_to_tweet_id: reply.in_reply_to_tweet_id };
      console.log('Replying to tweet:', reply.in_reply_to_tweet_id);
    } else if (reply_to) {
      tweetOptions.reply = { in_reply_to_tweet_id: reply_to };
      console.log('Replying to tweet:', reply_to);
    }
    
    // Handle media
    if (media_ids && media_ids.length > 0) {
      tweetOptions.media = { media_ids };
      console.log('Attaching media:', media_ids);
    }
    
    console.log('Tweet options:', tweetOptions);
    
    // Post tweet using Twitter API v2
    const tweet = await client.v2.tweet(text, tweetOptions);
    
    console.log('Tweet posted successfully:', tweet.data.id);
    
    return res.status(200).json({
      success: true,
      data: tweet.data
    });
    
  } catch (error) {
    console.error('Tweet error:', error);
    
    return res.status(500).json({
      error: error.message,
      code: error.code,
      data: error.data
    });
  }
}
