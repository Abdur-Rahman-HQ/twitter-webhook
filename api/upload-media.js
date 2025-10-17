import { TwitterApi } from 'twitter-api-v2';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { image_url, media_data } = req.body;
    
    if (!image_url && !media_data) {
      return res.status(400).json({ error: 'Either image_url or media_data is required' });
    }

    console.log('Initializing Twitter client...');
    
    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
    });

    let mediaId;

    if (image_url) {
      console.log('Downloading image from URL:', image_url);
      const imageResponse = await fetch(image_url);
      
      if (!imageResponse.ok) {
        return res.status(400).json({ error: 'Failed to download image from URL' });
      }
      
      const imageBuffer = await imageResponse.arrayBuffer();
      const buffer = Buffer.from(imageBuffer);
      
      console.log('Image downloaded, size:', buffer.length, 'bytes');
      console.log('Uploading to Twitter...');
      
      mediaId = await client.v1.uploadMedia(buffer, { mimeType: 'image/jpeg' });
      
    } else if (media_data) {
      console.log('Processing base64 media_data...');
      const cleanBase64 = media_data.replace(/^data:image\/\w+;base64,/, '').replace(/\s/g, '');
      const buffer = Buffer.from(cleanBase64, 'base64');
      
      console.log('Base64 decoded, size:', buffer.length, 'bytes');
      console.log('Uploading to Twitter...');
      
      mediaId = await client.v1.uploadMedia(buffer, { mimeType: 'image/jpeg' });
    }

    console.log('Upload successful! Media ID:', mediaId);

    return res.status(200).json({
      success: true,
      media_id_string: mediaId
    });

  } catch (error) {
    console.error('Upload error:', error);
    
    // More detailed error info
    return res.status(500).json({ 
      error: error.message,
      code: error.code,
      data: error.data,
      type: error.type
    });
  }
}
