import crypto from 'crypto';

function generateOAuthHeader(method, url, bodyParams, consumerKey, consumerSecret, tokenKey, tokenSecret) {
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
  
  // Combine OAuth params with body params for signature
  const allParams = { ...oauthParams, ...bodyParams };
  
  // Sort and encode
  const sortedKeys = Object.keys(allParams).sort();
  const paramString = sortedKeys
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(allParams[key])}`)
    .join('&');
  
  // Create signature base
  const signatureBase = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  
  // Generate signature
  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(signatureBase)
    .digest('base64');
  
  oauthParams.oauth_signature = signature;
  
  // Build header
  const authHeader = 'OAuth ' + Object.keys(oauthParams)
    .sort()
    .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
    .join(', ');
  
  return authHeader;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { media_data, media_category = 'tweet_image' } = req.body;
    
    if (!media_data) {
      return res.status(400).json({ error: 'media_data (base64) is required' });
    }

    // Step 1: INIT
    const initParams = {
      command: 'INIT',
      total_bytes: Buffer.from(media_data, 'base64').length.toString(),
      media_type: 'image/jpeg',
      media_category: media_category
    };
    
    const initAuthHeader = generateOAuthHeader(
      'POST',
      'https://upload.twitter.com/1.1/media/upload.json',
      initParams,
      process.env.TWITTER_API_KEY,
      process.env.TWITTER_API_SECRET,
      process.env.TWITTER_ACCESS_TOKEN,
      process.env.TWITTER_ACCESS_TOKEN_SECRET
    );

    const initBody = new URLSearchParams(initParams);
    
    const initResponse = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
      method: 'POST',
      headers: {
        'Authorization': initAuthHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: initBody.toString()
    });

    const initData = await initResponse.json();
    
    if (!initResponse.ok) {
      return res.status(initResponse.status).json({ error: 'INIT failed', details: initData });
    }

    const mediaId = initData.media_id_string;

    // Step 2: APPEND
    const appendParams = {
      command: 'APPEND',
      media_id: mediaId,
      segment_index: '0'
    };
    
    const appendAuthHeader = generateOAuthHeader(
      'POST',
      'https://upload.twitter.com/1.1/media/upload.json',
      appendParams,
      process.env.TWITTER_API_KEY,
      process.env.TWITTER_API_SECRET,
      process.env.TWITTER_ACCESS_TOKEN,
      process.env.TWITTER_ACCESS_TOKEN_SECRET
    );

    const appendBody = new URLSearchParams(appendParams);
    appendBody.append('media_data', media_data);
    
    const appendResponse = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
      method: 'POST',
      headers: {
        'Authorization': appendAuthHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: appendBody.toString()
    });

    if (!appendResponse.ok) {
      const appendError = await appendResponse.text();
      return res.status(appendResponse.status).json({ error: 'APPEND failed', details: appendError });
    }

    // Step 3: FINALIZE
    const finalizeParams = {
      command: 'FINALIZE',
      media_id: mediaId
    };
    
    const finalizeAuthHeader = generateOAuthHeader(
      'POST',
      'https://upload.twitter.com/1.1/media/upload.json',
      finalizeParams,
      process.env.TWITTER_API_KEY,
      process.env.TWITTER_API_SECRET,
      process.env.TWITTER_ACCESS_TOKEN,
      process.env.TWITTER_ACCESS_TOKEN_SECRET
    );

    const finalizeBody = new URLSearchParams(finalizeParams);
    
    const finalizeResponse = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
      method: 'POST',
      headers: {
        'Authorization': finalizeAuthHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: finalizeBody.toString()
    });

    const finalizeData = await finalizeResponse.json();
    
    if (!finalizeResponse.ok) {
      return res.status(finalizeResponse.status).json({ error: 'FINALIZE failed', details: finalizeData });
    }

    return res.status(200).json({ 
      success: true, 
      media_id_string: finalizeData.media_id_string 
    });
    
  } catch (error) {
    console.error('Media upload exception:', error);
    return res.status(500).json({ error: error.message, stack: error.stack });
  }
}
