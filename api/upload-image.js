import fetch from 'node-fetch';
import crypto from 'crypto';

function generateOAuthHeader(method, url, params, consumerKey, consumerSecret, tokenKey, tokenSecret) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  
  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: tokenKey,
    oauth_version: '1.0'
  };
  
  const allParams = { ...oauthParams, ...params };
  const sortedKeys = Object.keys(allParams).sort();
  const paramString = sortedKeys.map(key => 
    `${encodeURIComponent(key)}=${encodeURIComponent(allParams[key])}`
  ).join('&');
  
  const signatureBase = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  const signature = crypto.createHmac('sha1', signingKey).update(signatureBase).digest('base64');
  
  oauthParams.oauth_signature = signature;
  
  return 'OAuth ' + Object.keys(oauthParams)
    .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
    .join(', ');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { image_url } = req.body;
    
    if (!image_url) {
      return res.status(400).json({ error: 'image_url is required' });
    }
    
    console.log('Downloading image from:', image_url);
    
    // Download the image
    const imageResponse = await fetch(image_url);
    if (!imageResponse.ok) {
      return res.status(400).json({ error: 'Failed to download image' });
    }
    
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    
    console.log('Image downloaded, size:', imageBuffer.byteLength);
    
    // Upload to Twitter using v1.1 API
    const authHeader = generateOAuthHeader(
      'POST',
      'https://upload.twitter.com/1.1/media/upload.json',
      {},
      process.env.TWITTER_API_KEY,
      process.env.TWITTER_API_SECRET,
      process.env.TWITTER_ACCESS_TOKEN,
      process.env.TWITTER_ACCESS_TOKEN_SECRET
    );
    
    const formData = new URLSearchParams();
    formData.append('media_data', base64Image);
    
    const uploadResponse = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData
    });
    
    const uploadData = await uploadResponse.json();
    
    if (!uploadResponse.ok) {
      console.error('Upload error:', uploadData);
      return res.status(uploadResponse.status).json({ error: uploadData });
    }
    
    console.log('Media uploaded successfully:', uploadData.media_id_string);
    
    return res.status(200).json({
      success: true,
      data: {
        media_id: uploadData.media_id,
        media_id_string: uploadData.media_id_string,
        size: uploadData.size,
        expires_after_secs: uploadData.expires_after_secs
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
