const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { formatThumbnailUrl, extractVideoPath, cleanVideoData } = require('./utils');

const router = express.Router();

// Extract search results safely
function extractSearchResults(html) {
    try {
        // First try to find and parse the searchResult JSON
        const jsonMatch = html.match(/"searchResult":\s*({.*?"videoThumbProps":\s*\[.*?\]}),/s);
        if (jsonMatch) {
            let jsonStr = jsonMatch[1];

            // Remove trailing commas
            jsonStr = jsonStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

            // Fix unquoted keys safely
            jsonStr = jsonStr.replace(/([{,])\s*([a-zA-Z_][a-zA-Z0-9_]*):/g, '$1"$2":');

            try {
                const data = JSON.parse(jsonStr);
                if (data.videoThumbProps && Array.isArray(data.videoThumbProps)) {
                    const validVideos = data.videoThumbProps
                        .map(cleanVideoData)
                        .filter(v => v !== null); // Remove incomplete videos
                    
                    console.log(`Extracted ${validVideos.length} videos from JSON data`);
                    return validVideos;
                }
            } catch (parseErr) {
                console.error('JSON parse failed, fallback to Cheerio scraping');
            }
        }

        // Fallback: Look for videoThumbProps array in any script tag
        const scriptTags = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
        if (scriptTags) {
            for (const scriptTag of scriptTags) {
                const content = scriptTag.replace(/<script[^>]*>([\s\S]*?)<\/script>/, '$1');
                if (content.includes('"videoThumbProps"')) {
                    try {
                        const arrayMatch = content.match(/"videoThumbProps":\s*(\[[\s\S]*?\])\s*\}/);
                        if (arrayMatch) {
                            let arrayStr = arrayMatch[1];
                            
                            // Clean up the array string
                            arrayStr = arrayStr.replace(/,\s*]/g, ']').replace(/,\s*}/g, '}');
                            arrayStr = arrayStr.replace(/([{,])\s*([a-zA-Z_][a-zA-Z0-9_]*):/g, '$1"$2":');
                            
                            const videosArray = JSON.parse(arrayStr);
                            if (Array.isArray(videosArray)) {
                                const validVideos = videosArray
                                    .map(cleanVideoData)
                                    .filter(v => v !== null);
                                
                                console.log(`Extracted ${validVideos.length} videos from script tag fallback`);
                                return validVideos;
                            }
                        }
                    } catch (scriptParseErr) {
                        console.log('Script tag parsing failed, continuing...');
                    }
                }
            }
        }

        // Final fallback using Cheerio with improved validation
        const $ = cheerio.load(html);
        const videos = [];
        
        // Look for video containers with more specific selectors
        $('div[class*="video"], article[class*="video"], div[class*="thumb"], div[class*="item"]').each((i, el) => {
            const element = $(el);
            const video = {};

            const titleElem = element.find('h3, h4, a[title], .title, [class*="title"]').first();
            if (titleElem.length) {
                const title = titleElem.attr('title')?.trim() || titleElem.text()?.trim();
                if (title) video.title = title;
            }

            const linkElem = element.find('a[href]').first();
            if (linkElem.length) {
                const url = linkElem.attr('href')?.trim();
                if (url) video.pageURL = url;
            }

            const imgElem = element.find('img[src]').first();
            if (imgElem.length) {
                const thumbUrl = imgElem.attr('src')?.trim();
                if (thumbUrl) video.thumbURL = formatThumbnailUrl(thumbUrl);
            }

            const durationElem = element.find('.duration, .time, [class*="duration"], [class*="time"]').first();
            if (durationElem.length) {
                const duration = parseInt(durationElem.text().trim());
                if (duration > 0) video.duration = duration;
            }

            const viewsElem = element.find('.views, [class*="views"]').first();
            if (viewsElem.length) {
                const views = parseInt(viewsElem.text().replace(/[^0-9]/g, ''));
                if (views >= 0) video.views = views;
            }

            // Only process if URL contains /videos/
            if (!video.pageURL || !video.pageURL.includes('/videos/')) {
                return; // Skip this video
            }

            // Generate a fallback ID if missing
            if (!video.id && video.pageURL) {
                const idMatch = video.pageURL.match(/\/(\d+)/) || video.pageURL.match(/[a-zA-Z0-9]{7,}/);
                if (idMatch) {
                    // Create a more unique ID based on the URL slug
                    const slug = video.pageURL.split('/').pop() || '';
                    const hash = slug.split('').reduce((a, b) => {
                        a = ((a << 5) - a) + b.charCodeAt(0);
                        return a & a;
                    }, 0);
                    
                    // Use timestamp + hash for more uniqueness
                    video.id = Math.abs(hash) + Date.now() % 1000000;
                }
            }

            const cleaned = cleanVideoData(video);
            if (cleaned) videos.push(cleaned);
        });

        console.log(`Extracted ${videos.length} videos from HTML fallback`);
        return videos;
    } catch (err) {
        console.error('Extraction error:', err);
        return [];
    }
}

// Extract pagination info from HTML
function extractPaginationInfo(html) {
    try {
        const $ = cheerio.load(html);
        const pagination = {
            currentPage: 1,
            totalPages: 1,
            hasNext: false,
            hasPrevious: false
        };

        // Find current page
        const activePage = $('.xh-paginator-button.active').first();
        if (activePage.length) {
            pagination.currentPage = parseInt(activePage.attr('data-page')) || 1;
        }

        // Find total pages - look for the highest page number
        let maxPage = 1;
        $('.xh-paginator-button').each((i, el) => {
            const pageNum = parseInt($(el).attr('data-page'));
            if (pageNum && pageNum > maxPage) {
                maxPage = pageNum;
            }
        });
        pagination.totalPages = maxPage;

        // Check for next/previous buttons
        pagination.hasNext = $('.next a[data-page="next"]').length > 0;
        pagination.hasPrevious = $('.prev a[data-page="prev"]').length > 0;

        return pagination;
    } catch (err) {
        console.error('Pagination extraction error:', err);
        return {
            currentPage: 1,
            totalPages: 1,
            hasNext: false,
            hasPrevious: false
        };
    }
}

// Search endpoint
router.get('/:query/:page?', async (req, res) => {
    const { query, page = 1 } = req.params;
    const pageNum = parseInt(page) || 1;
    
    // Build search URL with pagination
    const searchUrl = `https://xhamster19.com/search/${encodeURIComponent(query)}${pageNum > 1 ? `?page=${pageNum}` : ''}`;
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Accept: 'text/html,application/xhtml+xml',
    };

    try {
        const { data } = await axios.get(searchUrl, { headers, timeout: 10000 });
        const results = extractSearchResults(data);
        const paginationInfo = extractPaginationInfo(data);
        
        console.log(`Search for "${query}" - Page ${pageNum}: Found ${results.length} raw results`);
        
        // Remove duplicates based on multiple criteria
        const uniqueVideos = [];
        const seenIds = new Set();
        const seenTitles = new Set();
        const seenUrls = new Set();
        
        results.forEach(video => {
            if (!video || !video.id || !video.title || !video.pageURL) {
                return; // Skip invalid videos
            }
            
            // Create a unique key combining ID, title, and URL
            const uniqueKey = `${video.id}-${video.title}-${video.pageURL}`;
            
            // Check if we've seen this exact video before
            if (seenIds.has(video.id) || seenTitles.has(video.title) || seenUrls.has(video.pageURL)) {
                console.log(`Skipping duplicate video: ${video.title} (ID: ${video.id})`);
                return;
            }
            
            // Add to seen sets
            seenIds.add(video.id);
            seenTitles.add(video.title);
            seenUrls.add(video.pageURL);
            
            uniqueVideos.push(video);
        });
        
        console.log(`After removing duplicates: ${uniqueVideos.length} unique videos`);
        
        // Additional response-level filtering for /videos URLs only
        const completeResults = uniqueVideos.filter(video => {
            return video && 
                   video.id && 
                   video.title && 
                   video.duration && 
                   video.pageURL && 
                   video.pageURL.includes('videos/') && // Ensure it's a video URL
                   video.thumbURL && 
                   video.views !== undefined;
        });

        console.log(`After filtering for complete data: ${completeResults.length} complete videos`);

        res.json({ 
            searchResult: completeResults,
            pagination: {
                currentPage: paginationInfo.currentPage,
                totalPages: paginationInfo.totalPages,
                hasNext: paginationInfo.hasNext,
                hasPrevious: paginationInfo.hasPrevious,
                requestedPage: pageNum
            },
            meta: {
                totalFound: results.length,
                uniqueVideos: uniqueVideos.length,
                completeVideos: completeResults.length,
                duplicatesRemoved: results.length - uniqueVideos.length,
                filtered: uniqueVideos.length - completeResults.length
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch search results', message: err.message });
    }
});

module.exports = router;
