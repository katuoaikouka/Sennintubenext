const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

// サーバーのポート設定
const PORT = process.env.PORT || 3000;

// 使用するInvidiousインスタンスのリスト（稼働率の高いものを優先）
const INVIDIOUS_INSTANCES = [
    'https://inv.nadeko.net',
    'https://invidious.f5.si',
    'https://invidious.lunivers.trade',
    'https://invidious.ducks.party',
];

// 静的ファイル（HTML, CSS, JS）を public フォルダから配信
app.use(express.static(path.join(__dirname, 'public')));

/**
 * YouTubeの画像サーバー(i.ytimg.com)のURLに書き換える補助関数
 */
function injectYoutubeThumbnails(video) {
    if (video.videoId) {
        const ytThumb = `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`;
        video.videoThumbnails = [
            { quality: 'high', url: ytThumb },
            { quality: 'medium', url: `https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg` }
        ];
    }
    
    if (video.authorThumbnails) {
        video.authorThumbnails.forEach(t => {
            if (t.url.startsWith('/')) {
                t.url = `https://invidious.f5.si${t.url}`;
            }
        });
    }
    return video;
}

/**
 * 複数のインスタンスを同時に叩き、最速のレスポンスを返す補助関数
 */
async function fetchFromFastestInstance(endpoint) {
    const controller = new AbortController();
    const requests = INVIDIOUS_INSTANCES.map(instance => 
        axios.get(`${instance}/api/v1${endpoint}`, { 
            signal: controller.signal,
            timeout: 6000 
        })
    );

    try {
        const fastestResponse = await Promise.any(requests);
        controller.abort(); // 他のリクエストをキャンセル
        return fastestResponse;
    } catch (e) {
        throw new Error('All instances failed');
    }
}

/**
 * 1. トレンド動画取得 API
 */
app.get('/api/trending', async (req, res) => {
    try {
        const response = await fetchFromFastestInstance('/trending?region=JP');
        const data = response.data.map(video => injectYoutubeThumbnails(video));
        res.json(data);
    } catch (error) {
        console.error('Trending API Error:', error.message);
        res.status(500).json({ error: 'トレンド動画の取得に失敗しました。' });
    }
});

/**
 * 2. 動画検索 API
 */
app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: '検索クエリが空です。' });

    try {
        const response = await fetchFromFastestInstance(`/search?q=${encodeURIComponent(query)}&region=JP`);
        const data = response.data
            .filter(item => item.type === 'video')
            .map(video => injectYoutubeThumbnails(video));
        res.json(data);
    } catch (error) {
        console.error('Search API Error:', error.message);
        res.status(500).json({ error: '検索の実行中にエラーが発生しました。' });
    }
});

/**
 * 3. 検索サジェスト API
 */
app.get('/api/suggestions', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.json([]);

    try {
        const url = `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&hl=ja&q=${encodeURIComponent(query)}`;
        const response = await axios.get(url);
        const match = response.data.match(/\((.*)\)/);
        if (match) {
            const data = JSON.parse(match);
            const suggestions = data.map(item => item);
            res.json(suggestions);
        } else {
            res.json([]);
        }
    } catch (error) {
        res.json([]); 
    }
});

/**
 * 4. 動画詳細情報取得 API (修正ポイント: フロントエンドとの互換性を確保)
 */
app.get('/api/video/:id', async (req, res) => {
    const videoId = req.params.id;
    try {
        // Invidiousからデータを取得
        const response = await fetchFromFastestInstance(`/videos/${videoId}`);
        let data = response.data;

        // フロントエンドの watch.html が期待する構造 (formatStreams / adaptiveFormats) を強制的に補完
        // InvidiousのAPI仕様により、プロパティ名が微妙に異なる場合があるためマッピング
        data.formatStreams = data.formatStreams || [];
        data.adaptiveFormats = data.adaptiveFormats || [];
        
        // 推奨動画（関連動画）の整形
        if (data.recommendedVideos) {
            data.recommendedVideos = data.recommendedVideos.map(v => injectYoutubeThumbnails(v));
        }

        data = injectYoutubeThumbnails(data);
        res.json(data);
    } catch (error) {
        console.error('Video Detail API Error:', error.message);
        res.status(500).json({ error: '動画情報の取得に失敗しました。' });
    }
});

/**
 * 4.5 コメント取得 API
 */
app.get('/api/comments/:id', async (req, res) => {
    try {
        const response = await fetchFromFastestInstance(`/comments/${req.params.id}`);
        // フロントが data.comments.map を呼ぶので、構造を保証する
        const comments = response.data.comments || [];
        res.json({ comments: comments });
    } catch (error) {
        console.error('Comments API Error:', error.message);
        res.json({ comments: [] });
    }
});

/**
 * 5. HTMLルーティング
 */
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/search', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/search.html'));
});

app.get('/watch', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/watch.html'));
});

app.get('/shorts.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/shorts.html'));
});

app.get('/history', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/history.html'));
});

/**
 * サーバー起動
 */
app.listen(PORT, () => {
    console.log('\n=========================================');
    console.log('    仙人チューブ NEXT サーバー起動完了');
    console.log('    (再生ページの互換性修正パッチ適用済)');
    console.log(`    動作URL: http://localhost:${PORT}`);
    console.log('=========================================\n');
});
