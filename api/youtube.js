const express = require('express');
const { Innertube, UniversalCache } = require('youtubei.js');
const app = express();
const path = require('path');
const PORT = process.env.PORT || 3000;

let youtube;

// Innertubeの初期化（キャッシュを有効化して高速化）
async function initYoutube() {
    try {
        youtube = await Innertube.create({
            cache: new UniversalCache(false),
            generate_session_locally: true
        });
        console.log('Innertube initialized successfully.');
    } catch (err) {
        console.error('Failed to initialize Innertube:', err);
    }
}

// 静的ファイルの提供
app.use(express.static(path.join(__dirname, 'public')));

// 1. 動画詳細情報の取得 (watch.html用)
app.get('/api/video/:id', async (req, res) => {
    try {
        const videoId = req.params.id;
        const info = await youtube.getInfo(videoId);
        
        // クライアントが必要なデータを整形
        const data = {
            id: info.basic_info.id,
            title: info.basic_info.title,
            description: info.basic_info.description,
            author: info.basic_info.author,
            viewCountText: info.primary_info?.view_count?.toString() || "不明な回数",
            publishedText: info.primary_info?.relative_date?.toString() || "",
            authorThumbnails: info.basic_info.thumbnail,
            formatStreams: info.streaming_data?.formats || [],
            adaptiveFormats: info.streaming_data?.adaptive_formats || [],
            recommendedVideos: info.watch_next_feed?.contents?.map(v => ({
                videoId: v.id,
                title: v.title?.toString(),
                author: v.author?.name,
                thumbnail: v.thumbnails?.[0]?.url
            })).filter(v => v.videoId) || []
        };
        
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Video data fetch failed' });
    }
});

// 2. コメントの取得
app.get('/api/comments/:id', async (req, res) => {
    try {
        const videoId = req.params.id;
        const threads = await youtube.getComments(videoId);
        
        const comments = threads.contents.map(c => ({
            author: c.author.name,
            content: c.content.toString(),
            thumbnails: c.author.thumbnails
        }));
        
        res.json({ comments });
    } catch (err) {
        res.status(500).json({ error: 'Comments fetch failed' });
    }
});

// 3. 検索候補（オートコンプリート）
app.get('/api/suggestions', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.json([]);
        const suggestions = await youtube.getSearchSuggestions(query);
        res.json(suggestions);
    } catch (err) {
        res.status(500).json({ error: 'Suggestions fetch failed' });
    }
});

// 4. 動画検索
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;
        const results = await youtube.search(query);
        
        const videos = results.videos.map(v => ({
            videoId: v.id,
            title: v.title.toString(),
            author: v.author.name,
            thumbnail: v.thumbnails[0].url,
            viewCount: v.view_count?.toString(),
            publishedTime: v.published?.toString()
        }));
        
        res.json(videos);
    } catch (err) {
        res.status(500).json({ error: 'Search failed' });
    }
});

// 5. Shortsフィードの取得 (shorts.html用)
app.get('/api/shorts', async (req, res) => {
    try {
        const shorts = await youtube.getShorts();
        
        const processedShorts = shorts.contents.map(video => ({
            videoId: video.id,
            title: video.title?.toString() || "Shorts Video",
            author: video.author?.name || "Unknown",
            authorThumbnail: video.author?.thumbnails?.[0]?.url || "",
            viewCount: video.view_count?.toString() || ""
        }));
        
        res.json(processedShorts);
    } catch (err) {
        res.status(500).json({ error: 'Shorts fetch failed' });
    }
});

// 6. 動画ストリーミング・リダイレクト (shorts.htmlのvideoタグ用)
app.get('/api/stream', async (req, res) => {
    try {
        const videoId = req.query.v;
        if (!videoId) return res.status(400).send('ID required');
        
        const info = await youtube.getInfo(videoId);
        const format = info.chooseFormat({ type: 'video+audio', quality: 'best' });
        
        if (!format) throw new Error('No format found');
        res.redirect(format.url);
    } catch (err) {
        res.status(500).send('Streaming error');
    }
});

// サーバー起動
app.listen(PORT, async () => {
    await initYoutube();
    console.log(`SenninTube Next Backend is running on http://localhost:${PORT}`);
});
