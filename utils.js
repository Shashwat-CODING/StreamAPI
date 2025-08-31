// Shared utility functions for video data processing

// Encode thumbnail URLs for xhpingcdn
function formatThumbnailUrl(url) {
    if (!url || !url.includes('xhpingcdn.com')) return url;
    return url.replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/,/g, '%2C');
}

// Extract video path from full URL
function extractVideoPath(fullUrl) {
    if (!fullUrl) return '';
    const match = fullUrl.match(/\/videos\/([^\/]+)/);
    return match ? `videos/${match[1]}` : '';
}

// Clean video object with strict validation
function cleanVideoData(video) {
    const fullPageURL = video.pageURL ? video.pageURL.trim() : '';
    
    // Only process videos with /videos in URL
    if (!fullPageURL.includes('/videos/')) {
        return null;
    }

    const cleaned = {
        id: video.id ? parseInt(video.id) : undefined,
        title: video.title ? video.title.trim() : '',
        duration: video.duration ? parseInt(video.duration) : undefined,
        created: video.created ? parseInt(video.created) : undefined,
        videoType: video.videoType || 'video',
        pageURL: extractVideoPath(fullPageURL), // Only return short path
        thumbURL: video.thumbURL ? formatThumbnailUrl(video.thumbURL.trim()) : '',
        previewThumbURL: video.previewThumbURL ? video.previewThumbURL.trim() : '',
        imageURL: video.imageURL ? formatThumbnailUrl(video.imageURL.trim()) : '',
        spriteURL: video.spriteURL ? video.spriteURL.trim() : '',
        trailerURL: video.trailerURL ? video.trailerURL.trim() : '',
        trailerFallbackUrl: video.trailerFallbackUrl ? video.trailerFallbackUrl.trim() : '',
        views: video.views ? parseInt(video.views) : 0,
        landing: video.landing
            ? {
                  type: video.landing.type,
                  id: video.landing.id ? parseInt(video.landing.id) : undefined,
                  name: video.landing.name || '',
                  logo: video.landing.logo || '',
                  link: video.landing.link || ''
              }
            : undefined,
        isThumbCustom: video.isThumbCustom || false,
        isAdminCustomThumb: video.isAdminCustomThumb || false,
        userCountry: video.userCountry || '',
        attributes: video.attributes || {},
        classes: video.classes || ''
    };

    // Strict validation - ALL essential fields must be present and valid
    const hasValidId = cleaned.id !== undefined && cleaned.id > 0;
    const hasValidTitle = cleaned.title && cleaned.title.length > 0;
    const hasValidDuration = cleaned.duration !== undefined && cleaned.duration > 0;
    const hasValidPageURL = cleaned.pageURL && cleaned.pageURL.length > 0;
    const hasValidThumbURL = cleaned.thumbURL && cleaned.thumbURL.length > 0;
    const hasValidViews = cleaned.views !== undefined && cleaned.views >= 0;

    // Only return if ALL essential fields are valid
    if (hasValidId && hasValidTitle && hasValidDuration && hasValidPageURL && hasValidThumbURL && hasValidViews) {
        return cleaned;
    }
    
    // Log what's missing for debugging (optional)
    console.log(`Filtered out video - Missing: ${[
        !hasValidId && 'id',
        !hasValidTitle && 'title', 
        !hasValidDuration && 'duration',
        !hasValidPageURL && 'pageURL',
        !hasValidThumbURL && 'thumbURL',
        !hasValidViews && 'views'
    ].filter(Boolean).join(', ')}`);
    
    return null; // Ignore incomplete videos
}

module.exports = {
    formatThumbnailUrl,
    extractVideoPath,
    cleanVideoData
};
