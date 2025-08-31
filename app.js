const express = require('express');
const searchRoutes = require('./search');
const detailsRoutes = require('./details');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for all origins
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

app.use(express.json());

// Mount the route modules
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/details', detailsRoutes);

// Root endpoint for API documentation
app.get('/', (req, res) => {
    res.json({
        message: 'Search API with pagination and video details',
        endpoints: { 
            search: '/api/v1/search/:query/:page?',
            details: '/api/v1/details/:path',
            examples: [
                'Search: /api/v1/search/indian/1, /api/v1/search/indian/2',
                'Details: /api/v1/details/videos/fun-for-birthday-party-excuses-xhKaU3h'
            ]
        },
        response_format: {
            search: {
                searchResult: 'Array of video objects with all essential fields',
                pagination: 'Page info (currentPage, totalPages, hasNext, hasPrevious)',
                meta: 'Statistics about filtering'
            },
            details: {
                video: 'Complete video metadata and details',
                streamUrl: 'Direct video stream URL (HLS/MP4)',
                relatedVideos: 'Array of related videos with enhanced fields (imageURL, spriteURL, trailerURL, landing info)',
                meta: 'Statistics about related videos filtering and extraction method'
            }
        },
        related_videos_fields: {
            id: 'Video ID',
            title: 'Video title',
            duration: 'Duration in seconds',
            pageURL: 'Short path format (videos/video-slug-id)',
            thumbURL: 'Thumbnail URL (formatted for xhpingcdn)',
            imageURL: 'High resolution image URL',
            spriteURL: 'Sprite image URL for video previews',
            trailerURL: 'Trailer video URL (AV1 format)',
            trailerFallbackUrl: 'Fallback trailer URL (MP4 format)',
            views: 'View count',
            landing: 'Creator/landing page information',
            userCountry: 'User country',
            isThumbCustom: 'Whether thumbnail is custom',
            isAdminCustomThumb: 'Whether admin set custom thumbnail'
        },
        notes: [
            'Only returns videos with complete data and /videos/ URLs',
            'pageURL returns short format: videos/video-slug-id',
            'Page parameter is optional, defaults to 1',
            'Details endpoint extracts stream URLs and related videos',
            'Related videos are extracted from relatedVideosComponent.videoTabInitialData structure',
            'Enhanced thumbnail URL formatting for xhpingcdn compatibility',
            'CORS enabled for all origins'
        ]
    });
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));