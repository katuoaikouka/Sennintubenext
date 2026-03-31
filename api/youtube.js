const express = require('express');
const { Innertube, UniversalCache } = require('youtubei.js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

let youtube;

/**
 * Innertubeの初期化
 * 日本のコンテンツを取得しやすくするため lang: 'ja', location: 'JP' を設定
 */
async function initYoutube() {
    try {
        youtube = await Innertube.create({
            cache: new UniversalCache(false),
            generate_session_locally: true,
            lang: 'ja',
            location: 'JP'
        });
        console.log('Innertube (Shorts Mode) initialized successfully.');
    } catch (err) {
        console.error('Failed to initialize Innertube:', err);
    }
}

// 静的ファイルの提供（publicフォルダ内のHTML/CSS用）
app.use(express.static(path.join(__dirname, 'public')));

/**
 * 1. Shortsフィードの取得
 * YouTubeの「Shorts」タブに相当する動画リストを返します。
 */
app.get('/api/shorts', async (req, res) => {
    try {
        // YouTubeのショートフィードを取得
        const shorts = await youtube.getShorts();
        
        // クライアント側で扱いやすい形式に整形
        const processedShorts = shorts.contents.map(video => ({
            videoId: video.id,
            title: video.title?.toString() || "Shorts Video",
            author: video.author?.name || "Unknown",
            authorThumbnail: video.author?.thumbnails?.?.url || "",
            viewCount: video.view_count?.toString() || "",
            // 直接再生用URL（API経由）
            streamUrl: `/api/stream?v=${video.id}`
        }));
        
        res.json(processedShorts);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Shorts feed fetch failed' });
    }
} );

/**
 * 2. ショート動画のストリーミングURLへのリダイレクト
 * <video src="/api/stream?v=xxx"> で直接再生できるようにします。
 */
app.get('/api/stream', async (req, res) => {
    try {
        const videoId = req.query.v;
        if (!videoId) return res.status(400).send('Video ID is required');
        
        const info = await youtube.getInfo(videoId);
        
        // ショート動画として最適な「映像+音声が合体した最高画質」を選択
        const format = info.chooseFormat({ 
            type: 'video+audio', 
            quality: 'best',
            format: 'mp4' 
        });
        
        if (!format || !format.url) {
            throw new Error('No playable format found');
        }
        
        // GoogleのビデオサーバーURLへリダイレクト
        res.redirect(format.url);
    } catch (err) {
        console.error(err);
        res.status(500).send('Streaming error');
    }
});

/**
 * 3. [オプション] 特定のキーワードでショート動画を検索
 */
app.get('/api/search/shorts', async (req, res) => {
    try {
        const query = req.query.q || '面白';
        const results = await youtube.search(query, {
            type: 'video',
            features: ['shorts'] // 検索フィルタでショート動画を指定
        });
        
        const videos = results.videos
            .filter(v => v.id) // IDが存在するもののみ
            .map(v => ({
                videoId: v.id,
                title: v.title.toString(),
                author: v.author.name,
                thumbnail: v.thumbnails.url,
                streamUrl: `/api/stream?v=${v.id}`
            }));
            
        res.json(videos);
    } catch (err) {
        res.status(500).json({ error: 'Shorts search failed' });
    }
});

// サーバー起動
app.listen(PORT, async () => {
    await initYoutube();
    console.log(`Shorts Dedicated Backend is running on http://localhost:${PORT}`);
});
