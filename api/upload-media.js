import crypto from 'crypto';

function percentEncode(str) {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/'/g, '%27');
}

function generateOAuthSignature(method, baseUrl, params, consumerSecret, tokenSecret) {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join('&');

  const signatureBaseString = `${method}&${percentEncode(baseUrl)}&${percentEncode(sortedParams)}`;
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  
  return crypto.createHmac('sha1', signingKey).update(signatureBaseString).digest('base64');
}

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

    // Clean base64 string
    const cleanBase64 = media_data.replace(/^data:image\/\w+;base64,/, '').replace(/\s/g, '');
    
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(32).toString('hex');
    
    // OAuth parameters for signature
    const oauthParams = {
      oauth_consumer_key: process.env.TWITTER_API_KEY,
      oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_token: process.env.TWITTER_ACCESS_TOKEN,
      oauth_version: '1.0'
    };

    // Generate signature
    const signature = generateOAuthSignature(
      'POST',
      'https://upload.twitter.com/1.1/media/upload.json',
      oauthParams,
      process.env.TWITTER_API_SECRET,
      process.env.TWITTER_ACCESS_TOKEN_SECRET
    );

    // Build Authorization header
    const authHeaderParams = {
      ...oauthParams,
      oauth_signature: signature
    };

    const authHeader = 'OAuth ' + Object.keys(authHeaderParams)
      .sort()
      .map(key => `${percentEncode(key)}="${percentEncode(authHeaderParams[key])}"`)
      .join(', ');

    // Prepare form data
    const formBody = `media_data=${encodeURIComponent(cleanBase64)}`;

    const response = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(formBody).toString()
      },
      body: formBody
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Twitter API Error:', JSON.stringify(data, null, 2));
      return res.status(response.status).json({ error: data });
    }

    return res.status(200).json({
      success: true,
      media_id_string: data.media_id_string,
      media_id: data.media_id
    });

  } catch (error) {
    console.error('Server Error:', error);
    return res.status(500).json({ error: error.message, stack: error.stack });
  }
}
