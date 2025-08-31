const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { formatThumbnailUrl, extractVideoPath, cleanVideoData } = require('./utils');

const router = express.Router();

// Extract video stream URL from preload link
function extractVideoStreamUrl(html) {
    try {
        const preloadMatch = html.match(/<link rel="preload" href="([^"]+)"[^>]*crossorigin="true">/);
        return preloadMatch ? preloadMatch[1] : null;
    } catch (err) {
        console.error('Stream URL extraction error:', err);
        return null;
    }
}



// Extract video details from videoModel using Cheerio
function extractVideoDetails(html) {
    try {
        const $ = cheerio.load(html);
        
        // Try to find videoModel in script tags first
        let videoModel = null;
        $('script').each((i, script) => {
            const content = $(script).html();
            if (content && content.includes('"videoModel"')) {
                try {
                    const videoModelMatch = content.match(/"videoModel":\s*({[^}]*(?:{[^}]*}[^}]*)*})/);
        if (videoModelMatch) {
            let jsonStr = videoModelMatch[1];
            
            // Clean up JSON string
            jsonStr = jsonStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
            jsonStr = jsonStr.replace(/([{,])\s*([a-zA-Z_][a-zA-Z0-9_]*):/g, '$1"$2":');
            
                        videoModel = JSON.parse(jsonStr);
                    }
                } catch (parseErr) {
                    console.error('Video model parse error:', parseErr);
                }
            }
        });
        
        if (videoModel) {
                return {
                    id: videoModel.id ? parseInt(videoModel.id) : undefined,
                    title: videoModel.title || videoModel.titleLocalized || '',
                    duration: videoModel.duration ? parseInt(videoModel.duration) : undefined,
                    created: videoModel.created ? parseInt(videoModel.created) : undefined,
                    views: videoModel.views ? parseInt(videoModel.views) : 0,
                    comments: videoModel.comments ? parseInt(videoModel.comments) : 0,
                    rating: videoModel.rating?.value || 0,
                    description: videoModel.description || '',
                    pageURL: extractVideoPath(videoModel.pageURL || ''),
                    thumbURL: formatThumbnailUrl(videoModel.thumbURL || ''),
                    previewThumbURL: videoModel.previewThumbURL || '',
                    spriteURL: videoModel.spriteURL || '',
                    trailerURL: videoModel.trailerURL || '',
                    downloadFile: videoModel.downloadFile || '',
                    isVR: videoModel.isVR || false,
                    isHD: videoModel.isHD || false,
                    isFHD: videoModel.isFHD || false,
                    isUHD: videoModel.isUHD || false,
                    author: videoModel.author ? {
                        id: videoModel.author.id,
                        name: videoModel.author.name || '',
                        pageURL: videoModel.author.pageURL || '',
                        verified: videoModel.author.verified || false
                    } : null
                };
        }
        
        // Fallback: Extract from HTML elements using Cheerio
        const videoDetails = {};
        
        // Extract title from meta tags or h1
        videoDetails.title = $('meta[property="og:title"]').attr('content') || 
                           $('h1').first().text().trim() || '';
        
        // Extract description from meta tags
        videoDetails.description = $('meta[property="og:description"]').attr('content') || '';
        
        // Extract thumbnail from meta tags
        videoDetails.thumbURL = formatThumbnailUrl($('meta[property="og:image"]').attr('content') || '');
        
        // Extract page URL from canonical or current URL
        videoDetails.pageURL = extractVideoPath($('link[rel="canonical"]').attr('href') || '');
        
        // Try to extract other details from HTML structure
        const durationText = $('.duration, .video-duration, [class*="duration"]').first().text().trim();
        if (durationText) {
            const durationMatch = durationText.match(/(\d+):(\d+)/);
            if (durationMatch) {
                videoDetails.duration = parseInt(durationMatch[1]) * 60 + parseInt(durationMatch[2]);
            }
        }
        
        const viewsText = $('.views, .video-views, [class*="views"]').first().text().trim();
        if (viewsText) {
            const viewsMatch = viewsText.match(/(\d+)/);
            if (viewsMatch) {
                videoDetails.views = parseInt(viewsMatch[1]);
            }
        }
        
        // Generate a fallback ID from the URL
        if (videoDetails.pageURL) {
            const idMatch = videoDetails.pageURL.match(/[a-zA-Z0-9]{7,}/);
            if (idMatch) {
                videoDetails.id = Math.abs(idMatch[0].split('').reduce((a, b) => {
                    a = ((a << 5) - a) + b.charCodeAt(0);
                    return a & a;
                }, 0));
            }
        }
        
        // Set defaults for missing fields
        videoDetails.created = videoDetails.created || Date.now();
        videoDetails.comments = videoDetails.comments || 0;
        videoDetails.rating = videoDetails.rating || 0;
        videoDetails.isVR = videoDetails.isVR || false;
        videoDetails.isHD = videoDetails.isHD || false;
        videoDetails.isFHD = videoDetails.isFHD || false;
        videoDetails.isUHD = videoDetails.isUHD || false;
        videoDetails.author = videoDetails.author || null;
        
        return videoDetails;
        
    } catch (err) {
        console.error('Video details extraction error:', err);
        return null;
    }
}

// Extract metadata from HTML meta tags
function extractMetadata(html) {
    try {
        const $ = cheerio.load(html);
        const metadata = {};
        
        // Extract OpenGraph metadata
        metadata.title = $('meta[property="og:title"]').attr('content') || '';
        metadata.description = $('meta[property="og:description"]').attr('content') || '';
        metadata.image = $('meta[property="og:image"]').attr('content') || '';
        metadata.url = $('meta[property="og:url"]').attr('content') || '';
        metadata.siteName = $('meta[property="og:site_name"]').attr('content') || '';
        metadata.type = $('meta[property="og:type"]').attr('content') || '';
        
        // Extract Twitter metadata
        metadata.twitterCard = $('meta[name="twitter:card"]').attr('content') || '';
        metadata.twitterSite = $('meta[name="twitter:site"]').attr('content') || '';
        metadata.twitterCreator = $('meta[name="twitter:creator"]').attr('content') || '';
        
        // Extract canonical URL
        metadata.canonical = $('link[rel="canonical"]').attr('href') || '';
        metadata.ampUrl = $('link[rel="amphtml"]').attr('href') || '';
        
        // Convert full URLs to short format
        if (metadata.url) metadata.url = extractVideoPath(metadata.url);
        if (metadata.canonical) metadata.canonical = extractVideoPath(metadata.canonical);
        if (metadata.ampUrl) metadata.ampUrl = extractVideoPath(metadata.ampUrl);
        if (metadata.image) metadata.image = formatThumbnailUrl(metadata.image);
        
        return metadata;
    } catch (err) {
        console.error('Metadata extraction error:', err);
        return {};
    }
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

// Helper function to parse video array from JSON string
function parseVideoArray(videosArrayStr) {
            const videoObjects = [];
    
    try {
        console.log(`Parsing video array string of length: ${videosArrayStr.length}`);
        
        // First try to parse the entire array as JSON
        let cleanArrayStr = videosArrayStr.trim();
        
        // Remove trailing commas
        cleanArrayStr = cleanArrayStr.replace(/,\s*]/g, ']');
        cleanArrayStr = cleanArrayStr.replace(/,\s*}/g, '}');
        
        // Fix unquoted keys
        cleanArrayStr = cleanArrayStr.replace(/([{,])\s*([a-zA-Z_][a-zA-Z0-9_]*):/g, '$1"$2":');
        
        // Try to parse as JSON first
        try {
            const videosArray = JSON.parse(cleanArrayStr);
            if (Array.isArray(videosArray)) {
                console.log(`Successfully parsed ${videosArray.length} videos as JSON array`);
                return videosArray.filter(video => 
                    video && video.id && video.title && video.pageURL
                );
            }
        } catch (jsonErr) {
            console.log('JSON parse failed, using manual parsing:', jsonErr.message);
        }
        
        // Manual parsing fallback - look for individual video objects
        const videoRegex = /"id":\s*(\d+)[^}]*?"title":\s*"([^"]*)"[^}]*?"pageURL":\s*"([^"]*)"[^}]*?"thumbURL":\s*"([^"]*)"[^}]*?"duration":\s*(\d+)[^}]*?"views":\s*(\d+)/g;
        let match;
        
        while ((match = videoRegex.exec(videosArrayStr)) !== null) {
            try {
                const video = {
                    id: parseInt(match[1]),
                    title: match[2],
                    pageURL: match[3],
                    thumbURL: match[4],
                    duration: parseInt(match[5]),
                    views: parseInt(match[6])
                };
                
                if (video.id && video.title && video.pageURL && video.thumbURL && video.duration && video.views) {
                    videoObjects.push(video);
                    console.log(`Parsed video: ${video.title} (ID: ${video.id})`);
                }
            } catch (parseErr) {
                console.log('Failed to parse video from regex match:', parseErr.message);
            }
        }
        
        // If regex method didn't work, try manual bracket counting
        if (videoObjects.length === 0) {
            console.log('Regex method failed, trying manual bracket counting...');
            let bracketCount = 0;
            let objectStart = -1;
            let inString = false;
            let escaped = false;
            
            for (let i = 0; i < videosArrayStr.length; i++) {
                const char = videosArrayStr[i];
                
                if (escaped) {
                    escaped = false;
                    continue;
                }
                
                if (char === '\\') {
                    escaped = true;
                    continue;
                }
                
                if (char === '"' && !escaped) {
                    inString = !inString;
                }
                
                if (!inString) {
                    if (char === '{') {
                        if (bracketCount === 0) {
                            objectStart = i;
                        }
                        bracketCount++;
                    }
                    if (char === '}') {
                        bracketCount--;
                        if (bracketCount === 0 && objectStart !== -1) {
                            // We have a complete object
                            const objStr = videosArrayStr.substring(objectStart, i + 1);
                            try {
                                let cleanObj = objStr.trim();
                                
                                // Fix unquoted keys
                                cleanObj = cleanObj.replace(/([{,])\s*([a-zA-Z_][a-zA-Z0-9_]*):/g, '$1"$2":');
                        
                        const videoObj = JSON.parse(cleanObj);
                        if (videoObj.id && videoObj.title && videoObj.pageURL) {
                            videoObjects.push(videoObj);
                                    console.log(`Parsed video object: ${videoObj.title} (ID: ${videoObj.id})`);
                                }
                            } catch (objParseErr) {
                                console.log('Failed to parse video object:', objParseErr.message);
                            }
                            objectStart = -1;
                        }
                    }
                }
            }
        }
        
        console.log(`Successfully parsed ${videoObjects.length} video objects`);
        return videoObjects;
        
    } catch (err) {
        console.error('Error in parseVideoArray:', err);
        return [];
    }
}

// Extract related videos using Cheerio for better HTML parsing
function extractRelatedVideos(html) {
    try {
        const $ = cheerio.load(html);
        const videos = [];
        
        console.log('Starting related videos extraction...');
        
        // Method 1: Look for relatedVideosComponent in script tags
        $('script').each((i, script) => {
            const content = $(script).html();
            if (content && content.includes('"relatedVideosComponent"')) {
                console.log('Found relatedVideosComponent in script tag');
                try {
                    // Look for the specific structure: relatedVideosComponent.videoTabInitialData.videoListProps.videoThumbProps
                    const dataMatch = content.match(/"relatedVideosComponent":\s*\{[^}]*"videoTabInitialData":\s*\{[^}]*"videoListProps":\s*\{[^}]*"videoThumbProps":\s*(\[[\s\S]*?\])\s*\}/);
                    
                    if (dataMatch) {
                        console.log('Extracted videoThumbProps array from relatedVideosComponent');
                        let videosArrayStr = dataMatch[1];
                        
                        // Parse individual video objects
                        const videoObjects = parseVideoArray(videosArrayStr);
                        videos.push(...videoObjects);
                        console.log(`Added ${videoObjects.length} videos from relatedVideosComponent`);
                    }
                } catch (parseErr) {
                    console.log('Failed to parse relatedVideosComponent:', parseErr.message);
                }
            }
        });
        
        // Method 2: Look for videoTabInitialData in script tags (fallback)
        if (videos.length === 0) {
            $('script').each((i, script) => {
                const content = $(script).html();
                if (content && content.includes('"videoTabInitialData"')) {
                    console.log('Found videoTabInitialData in script tag (fallback)');
                    try {
                        const dataMatch = content.match(/"videoTabInitialData":\s*\{[^}]*"videoListProps":\s*\{[^}]*"videoThumbProps":\s*(\[[\s\S]*?\])\s*\}/);
                        
                        if (dataMatch) {
                            console.log('Extracted videoThumbProps array from videoTabInitialData');
                            let videosArrayStr = dataMatch[1];
                            
                            // Parse individual video objects
                            const videoObjects = parseVideoArray(videosArrayStr);
                            videos.push(...videoObjects);
                            console.log(`Added ${videoObjects.length} videos from videoTabInitialData`);
                        }
                    } catch (parseErr) {
                        console.log('Failed to parse videoTabInitialData:', parseErr.message);
                    }
                }
            });
        }
        
        // Method 3: Look for any videoThumbProps array in script tags
        if (videos.length === 0) {
            $('script').each((i, script) => {
                const content = $(script).html();
                if (content && content.includes('"videoThumbProps"')) {
                    console.log('Found videoThumbProps in script tag (general search)');
                    try {
                        const dataMatch = content.match(/"videoThumbProps":\s*(\[[\s\S]*?\])\s*\}/);
        
        if (dataMatch) {
                            console.log('Extracted videoThumbProps array (general search)');
            let videosArrayStr = dataMatch[1];
                            
                            // Parse individual video objects
                            const videoObjects = parseVideoArray(videosArrayStr);
                            videos.push(...videoObjects);
                            console.log(`Added ${videoObjects.length} videos from general videoThumbProps search`);
                        }
                    } catch (parseErr) {
                        console.log('Failed to parse general videoThumbProps:', parseErr.message);
                    }
                }
            });
        }
        
        // Method 4: Extract from HTML elements using Cheerio selectors
        if (videos.length === 0) {
            console.log('No videos found in script tags, trying HTML element extraction...');
            $('.related-video, [class*="related"], [class*="video-item"], .video-thumb, [class*="thumb"], .video-card, [class*="card"]').each((i, el) => {
                const element = $(el);
                const video = {};
                
                // Extract title
                const titleElem = element.find('h3, h4, a[title], .title, [class*="title"]').first();
                if (titleElem.length) {
                    video.title = titleElem.attr('title')?.trim() || titleElem.text()?.trim();
                }
                
                // Extract link
                const linkElem = element.find('a[href]').first();
                if (linkElem.length) {
                    const url = linkElem.attr('href')?.trim();
                    if (url && url.includes('/videos/')) {
                        video.pageURL = url;
                    }
                }
                
                // Extract thumbnail
                const imgElem = element.find('img[src]').first();
                if (imgElem.length) {
                    video.thumbURL = formatThumbnailUrl(imgElem.attr('src')?.trim());
                }
                
                // Extract duration
                const durationElem = element.find('.duration, .time, [class*="duration"]').first();
                if (durationElem.length) {
                    const durationText = durationElem.text().trim();
                    const durationMatch = durationText.match(/(\d+):(\d+)/);
                    if (durationMatch) {
                        video.duration = parseInt(durationMatch[1]) * 60 + parseInt(durationMatch[2]);
                    }
                }
                
                // Extract views
                const viewsElem = element.find('.views, [class*="views"]').first();
                if (viewsElem.length) {
                    const viewsText = viewsElem.text().trim();
                    const viewsMatch = viewsText.match(/(\d+)/);
                    if (viewsMatch) {
                        video.views = parseInt(viewsMatch[1]);
                    }
                }
                
                // Generate ID from URL if missing
                if (!video.id && video.pageURL) {
                    const idMatch = video.pageURL.match(/[a-zA-Z0-9]{7,}/);
                    if (idMatch) {
                        video.id = Math.abs(idMatch[0].split('').reduce((a, b) => {
                            a = ((a << 5) - a) + b.charCodeAt(0);
                            return a & a;
                        }, 0));
                    }
                }
                
                // Only add if we have essential fields
                if (video.title && video.pageURL && video.thumbURL) {
                    videos.push(video);
                    console.log(`Extracted video from HTML: ${video.title}`);
                }
            });
            console.log(`Extracted ${videos.length} videos from HTML elements`);
        }
        
        // Method 5: Look for any video data patterns in the entire HTML
        if (videos.length === 0) {
            console.log('Trying to find any video data patterns in HTML...');
            
            // Look for any JSON-like structures that might contain video data
            const jsonPatterns = [
                /"id":\s*(\d+)[^}]*?"title":\s*"([^"]*)"[^}]*?"pageURL":\s*"([^"]*)"[^}]*?"thumbURL":\s*"([^"]*)"[^}]*?"duration":\s*(\d+)/g,
                /"title":\s*"([^"]*)"[^}]*?"pageURL":\s*"([^"]*)"[^}]*?"thumbURL":\s*"([^"]*)"[^}]*?"duration":\s*(\d+)/g
            ];
            
            for (const pattern of jsonPatterns) {
                let match;
                while ((match = pattern.exec(html)) !== null) {
                    try {
                        const video = {
                            id: match[1] ? parseInt(match[1]) : Math.abs(match[2]?.split('').reduce((a, b) => {
                                a = ((a << 5) - a) + b.charCodeAt(0);
                                return a & a;
                            }, 0) || 0),
                            title: match[1] ? match[2] : match[1],
                            pageURL: match[1] ? match[3] : match[2],
                            thumbURL: match[1] ? match[4] : match[3],
                            duration: parseInt(match[1] ? match[5] : match[4])
                        };
                        
                        if (video.title && video.pageURL && video.thumbURL && video.pageURL.includes('/videos/')) {
                            videos.push(video);
                            console.log(`Extracted video from pattern: ${video.title}`);
                        }
                    } catch (parseErr) {
                        console.log('Failed to parse video from pattern match:', parseErr.message);
                    }
                }
            }
            
            console.log(`Extracted ${videos.length} videos from pattern matching`);
        }
        
        console.log(`Total videos found: ${videos.length}`);
        
        // Clean and filter the extracted video objects
        const cleanedVideos = videos
            .map(cleanVideoData)
            .filter(v => v !== null);
            
        console.log(`After cleaning and filtering: ${cleanedVideos.length} videos`);
        
        return cleanedVideos;
        
    } catch (err) {
        console.error('Related videos extraction error:', err);
        return [];
    }
}

// Details endpoint
router.get('/:path(*)', async (req, res) => {
    const { path } = req.params;
    
    // Ensure path starts with videos/
    if (!path.startsWith('videos/')) {
        return res.status(400).json({ error: 'Invalid path. Must start with videos/' });
    }
    
    const videoUrl = `https://xhamster19.com/${path}`;
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Accept: 'text/html,application/xhtml+xml',
    };

    try {
        const { data } = await axios.get(videoUrl, { headers, timeout: 15000 });
        
        // Extract main video details
        const videoDetails = extractVideoDetails(data);
        if (!videoDetails) {
            return res.status(404).json({ error: 'Video details not found' });
        }
        
        // Extract metadata from meta tags
        const metadata = extractMetadata(data);
        
        // Extract stream URL
        const streamUrl = extractVideoStreamUrl(data);
        
        // Extract related videos with improved logging
        console.log('Extracting related videos...');
        const relatedVideos = extractRelatedVideos(data);
        console.log(`Found ${relatedVideos.length} related videos`);
        
        // Remove duplicates from related videos
        const uniqueRelatedVideos = [];
        const seenKeys = new Set();
        
        relatedVideos.forEach(video => {
            if (!video || !video.id || !video.title || !video.pageURL) {
                return; // Skip invalid videos
            }
            
            // Create a unique key combining ID, title, and URL
            const uniqueKey = `${video.id}-${video.title}-${video.pageURL}`;
            
            // Only skip if we've seen this exact combination before
            if (seenKeys.has(uniqueKey)) {
                console.log(`Skipping exact duplicate related video: ${video.title} (ID: ${video.id})`);
                return;
            }
            
            // Add to seen keys
            seenKeys.add(uniqueKey);
            uniqueRelatedVideos.push(video);
        });
        
        console.log(`After removing duplicates: ${uniqueRelatedVideos.length} unique related videos`);
        
        // Filter related videos to only complete ones with /videos/ URLs
        const completeRelatedVideos = uniqueRelatedVideos.filter(video => {
            return video && 
                   video.id && 
                   video.title && 
                   video.duration && 
                   video.pageURL && 
                   video.pageURL.includes('videos/') &&
                   video.thumbURL && 
                   video.views !== undefined;
        });

        console.log(`Filtered to ${completeRelatedVideos.length} complete related videos`);

        res.json({
            video: videoDetails,
            metadata: metadata,
            streamUrl: streamUrl,
            relatedVideos: completeRelatedVideos,
            meta: {
                totalRelated: relatedVideos.length,
                uniqueRelated: uniqueRelatedVideos.length,
                completeRelated: completeRelatedVideos.length,
                filteredRelated: uniqueRelatedVideos.length - completeRelatedVideos.length,
                duplicatesRemoved: relatedVideos.length - uniqueRelatedVideos.length,
                extractionMethod: 'relatedVideosComponent.videoTabInitialData.videoListProps.videoThumbProps'
            }
        });
        
    } catch (err) {
        console.error(err.message);
        if (err.response?.status === 404) {
            res.status(404).json({ error: 'Video not found' });
        } else {
            res.status(500).json({ error: 'Failed to fetch video details', message: err.message });
        }
    }
});

module.exports = router;
