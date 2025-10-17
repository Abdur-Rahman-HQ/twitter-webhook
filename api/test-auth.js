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
  const paramString = sortedKeys.map(key => `${encodeURIComponent(key)}=${encodeURIComponent(allParams[key])}`).join('&');
  
  const signatureBase = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  const signature = crypto.createHmac('sha1', signingKey).update(signatureBase).digest('base64');
  
  oauthParams.oauth_signature = signature;
  
  const authHeader = 'OAuth ' + Object.keys(oauthParams)
    .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
    .join(', ');
  
  return authHeader;
}

export default async function handler(req, res) {
  try {
    // Test with verify_credentials endpoint
    const authHeader = generateOAuthHeader(
      'GET',
      'https://api.twitter.com/1.1/account/verify_credentials.json',
      {},
      process.env.TWITTER_API_KEY,
      process.env.TWITTER_API_SECRET,
      process.env.TWITTER_ACCESS_TOKEN,
      process.env.TWITTER_ACCESS_TOKEN_SECRET
    );
    
    const response = await fetch('https://api.twitter.com/1.1/account/verify_credentials.json', {
      method: 'GET',
      headers: {
        'Authorization': authHeader
      }
    });
    
    const data = await response.json();
    
    return res.status(200).json({
      credentials_valid: response.ok,
      response: data
    });
    
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
