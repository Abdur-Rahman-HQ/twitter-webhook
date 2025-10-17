import crypto from 'crypto';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { media_data } = req.body;
    
    if (!media_data) {
      return res.status(400).json({ error: 'media_data is required' });
    }

    const cleanBase64 = media_data.replace(/^data:image\/\w+;base64,/, '').replace(/\s/g, '');
    
    const consumerKey = process.env.TWITTER_API_KEY;
    const consumerSecret = process.env.TWITTER_API_SECRET;
    const accessToken = process.env.TWITTER_ACCESS_TOKEN;
    const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;
    
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = crypto.randomBytes(32).toString('base64').replace(/\W/g, '');
    
    // OAuth parameters - ONLY these go in the signature
    const oauthParams = {
      oauth_consumer_key: consumerKey,
      oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_token: accessToken,
      oauth_version: '1.0'
    };
    
    // Create parameter string for signature (NO media_data here!)
    const paramString = Object.keys(oauthParams)
      .sort()
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(oauthParams[key])}`)
      .join('&');
    
    // Create signature base string
    const signatureBaseString = [
      'POST',
      encodeURIComponent('https://upload.twitter.com/1.1/media/upload.json'),
      encodeURIComponent(paramString)
    ].join('&');
    
    // Create signing key
    const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(accessTokenSecret)}`;
    
    // Generate signature
    const signature = crypto.createHmac('sha1', signingKey)
      .update(signatureBaseString)
      .digest('base64');
    
    // Build authorization header
    const authHeader = 'OAuth ' + Object.keys(oauthParams)
      .concat(['oauth_signature'])
      .sort()
      .map(key => {
        const value = key === 'oauth_signature' ? signature : oauthParams[key];
        return `${encodeURIComponent(key)}="${encodeURIComponent(value)}"`;
      })
      .join(', ');
    
    // Create form body with media_data
    const formBody = `media_data=${encodeURIComponent(cleanBase64)}`;
    
    console.log('Attempting media upload to Twitter...');
    
    const response = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formBody
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('Twitter API Error:', JSON.stringify(data, null, 2));
      return res.status(response.status).json({ 
        error: data,
        debug: {
          timestamp,
          nonce,
          signature_params: Object.keys(oauthParams)
        }
      });
    }
    
    console.log('Media uploaded successfully:', data.media_id_string);
    
    return res.status(200).json({
      success: true,
      media_id_string: data.media_id_string,
      media_id: data.media_id
    });
    
  } catch (error) {
    console.error('Server Error:', error.message);
    return res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
}
