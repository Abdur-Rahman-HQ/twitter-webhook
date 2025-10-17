export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { media_data, image_url } = req.body;
    
    let base64Image;
    
    if (image_url) {
      // Download from URL
      console.log('Downloading image from:', image_url);
      const imageResponse = await fetch(image_url);
      if (!imageResponse.ok) {
        return res.status(400).json({ error: 'Failed to download image from URL' });
      }
      const imageBuffer = await imageResponse.arrayBuffer();
      base64Image = Buffer.from(imageBuffer).toString('base64');
    } else if (media_data) {
      // Use provided base64
      base64Image = media_data.replace(/^data:image\/\w+;base64,/, '').replace(/\s/g, '');
    } else {
      return res.status(400).json({ error: 'Either media_data or image_url is required' });
    }

    console.log('Base64 image size:', base64Image.length, 'characters');

    // Use native Node.js crypto for OAuth
    const crypto = await import('crypto');
    
    const oauth = {
      consumer_key: process.env.TWITTER_API_KEY,
      consumer_secret: process.env.TWITTER_API_SECRET,
      token: process.env.TWITTER_ACCESS_TOKEN,
      token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
      signature_method: 'HMAC-SHA1',
      version: '1.0'
    };

    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = crypto.randomBytes(32).toString('hex');

    // Build OAuth parameters
    const oauthParams = {
      oauth_consumer_key: oauth.consumer_key,
      oauth_nonce: nonce,
      oauth_signature_method: oauth.signature_method,
      oauth_timestamp: timestamp,
      oauth_token: oauth.token,
      oauth_version: oauth.version
    };

    // Sort and encode parameters for signature
    const parameterString = Object.keys(oauthParams)
      .sort()
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(oauthParams[key])}`)
      .join('&');

    // Create signature base string
    const signatureBaseString = [
      'POST',
      encodeURIComponent('https://upload.twitter.com/1.1/media/upload.json'),
      encodeURIComponent(parameterString)
    ].join('&');

    // Create signing key
    const signingKey = `${encodeURIComponent(oauth.consumer_secret)}&${encodeURIComponent(oauth.token_secret)}`;

    // Generate signature
    const signature = crypto.createHmac('sha1', signingKey)
      .update(signatureBaseString)
      .digest('base64');

    // Build Authorization header
    const authParams = {
      ...oauthParams,
      oauth_signature: signature
    };

    const authHeader = 'OAuth ' + Object.keys(authParams)
      .sort()
      .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(authParams[key])}"`)
      .join(', ');

    console.log('Uploading to Twitter...');

    // Create form data
    const formData = new URLSearchParams();
    formData.append('media_data', base64Image);

    const response = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': formData.toString().length
      },
      body: formData.toString()
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Twitter API Error:', JSON.stringify(data, null, 2));
      console.error('Response status:', response.status);
      console.error('OAuth params used:', oauthParams);
      return res.status(response.status).json({ 
        error: data,
        debug: {
          status: response.status,
          timestamp,
          base64_length: base64Image.length
        }
      });
    }

    console.log('Media upload successful! Media ID:', data.media_id_string);

    return res.status(200).json({
      success: true,
      media_id_string: data.media_id_string,
      media_id: data.media_id
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
}
