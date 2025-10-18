import { TwitterApi } from 'twitter-api-v2';

export default async function handler(req, res) {
  try {
    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY?.trim(),
      appSecret: process.env.TWITTER_API_SECRET?.trim(),
      accessToken: process.env.TWITTER_ACCESS_TOKEN?.trim(),
      accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET?.trim(),
    });
    
    // Get rate limit status for specific resources
    const rateLimitStatus = await client.v1.rateLimitStatuses(['statuses', 'media', 'users']);
    
    // Extract relevant endpoints
    const tweetLimits = rateLimitStatus.resources.statuses;
    const mediaLimits = rateLimitStatus.resources.media;
    const usersLimits = rateLimitStatus.resources.users;
    
    // Calculate reset times
    const formatResetTime = (timestamp) => {
      const resetDate = new Date(timestamp * 1000);
      const now = new Date();
      const minutesUntilReset = Math.ceil((resetDate - now) / 60000);
      return {
        resetTime: resetDate.toISOString(),
        minutesUntilReset: minutesUntilReset > 0 ? minutesUntilReset : 0
      };
    };
    
    return res.status(200).json({
      success: true,
      summary: {
        canPostTweet: tweetLimits?.['/statuses/update']?.remaining > 0,
        canUploadMedia: mediaLimits?.['/media/upload']?.remaining > 0
      },
      limits: {
        tweet_posting: tweetLimits?.['/statuses/update'] ? {
          limit: tweetLimits['/statuses/update'].limit,
          remaining: tweetLimits['/statuses/update'].remaining,
          ...formatResetTime(tweetLimits['/statuses/update'].reset)
        } : 'Not available (using v2 API)',
        media_upload: mediaLimits?.['/media/upload'] ? {
          limit: mediaLimits['/media/upload'].limit,
          remaining: mediaLimits['/media/upload'].remaining,
          ...formatResetTime(mediaLimits['/media/upload'].reset)
        } : null,
        timeline_access: tweetLimits?.['/statuses/user_timeline'] ? {
          limit: tweetLimits['/statuses/user_timeline'].limit,
          remaining: tweetLimits['/statuses/user_timeline'].remaining,
          ...formatResetTime(tweetLimits['/statuses/user_timeline'].reset)
        } : null
      },
      note: 'V2 API tweet posting limits are not shown in v1.1 rate limit status. Free tier allows 50 tweets per 24 hours.',
      account: rateLimitStatus.rate_limit_context
    });
    
  } catch (error) {
    console.error('Rate limit check error:', error);
    return res.status(500).json({ 
      error: error.message,
      details: error.data 
    });
  }
}
