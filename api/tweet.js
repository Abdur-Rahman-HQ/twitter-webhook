import OAuth from 'oauth-1.0a';
import crypto from 'crypto';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // DEBUG: Check if environment variables exist
  const hasApiKey = !!process.env.TWITTER_API_KEY;
  const hasApiSecret = !!process.env.TWITTER_API_SECRET;
  const hasAccessToken = !!process.env.TWITTER_ACCESS_TOKEN;
  const hasTokenSecret = !!process.env.TWITTER_ACCESS_TOKEN_SECRET;

  console.log('Environment check:', {
    hasApiKey,
    hasApiSecret,
    hasAccessToken,
    hasTokenSecret
  });

  // Return error if any credential is missing
  if (!hasApiKey || !hasApiSecret || !hasAccessToken || !hasTokenSecret) {
    return res.status(500).json({
      error: 'Missing environment variables',
      debug: { hasApiKey, hasApiSecret, hasAccessToken, hasTokenSecret }
    });
  }

  try {
    const { text, reply_to } = req.body;

    // Initialize OAuth
    const oauth = new OAuth({
      consumer: {
        key: process.env.TWITTER_API_KEY,
        secret: process.env.TWITTER_API_SECRET
      },
      signature_method: 'HMAC-SHA1',
      hash_function(base_string, key) {
        return crypto.createHmac('sha1', key).update(base_string).digest('base64');
      }
    });

    const token = {
      key: process.env.TWITTER_ACCESS_TOKEN,
      secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
    };

    // Build request body
    const body = { text };
    if (reply_to) {
      body.reply = { in_reply_to_tweet_id: reply_to };
    }

    const requestData = {
      url: 'https://api.twitter.com/2/tweets',
      method: 'POST',
      data: body
    };

    const authHeader = oauth.toHeader(oauth.authorize(requestData, token));

    console.log('Making Twitter API request...');

    // Make the actual Twitter API request
    const response = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        ...authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    console.log('Twitter API response status:', response.status);
    console.log('Twitter API response:', data);

    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }

    return res.status(200).json({ success: true, data });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
