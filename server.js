const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3000;

const INVIDIOUS_INSTANCES = [
    'https://inv.nadeko.net',
    'https://invidious.f5.si',
    'https://invidious.lunivers.trade',
    'https://invidious.ducks.party',
];

app.use(express.static(path.join(__dirname, 'public')));

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

async function fetchFromFastestInstance(endpoint) {
    const requests = INVIDIOUS_INSTANCES.map(instance => 
        axios.get(`${instance}/api/v1${endpoint}`, { timeout: 5000 })
    );
    const fastestResponse = await Promise.any(requests);
    return fastestResponse;
}

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

app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (!query) {
        return res.status(400).json({ error: '検索クエリが空です。' });
    }

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

app.get('/api/suggestions', async (req, res) => {
    const query = req.query.q;
    if (!query) {
        return res.json([]);
    }

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
        console.error('Suggestions API Error:', error.message);
        res.json([]); 
    }
});

app.get('/api/video/:id', async (req, res) => {
    const videoId = req.params.id;
    try {
        const response = await fetchFromFastestInstance(`/videos/${videoId}`);
        const data = injectYoutubeThumbnails(response.data);
        res.json(data);
    } catch (error) {
        console.error('Video Detail API Error:', error.message);
        res.status(500).json({ error: '動画詳細の取得に失敗しました。' });
    }
});

app.get('/api/comments/:id', async (req, res) => {
    try {
        const response = await fetchFromFastestInstance(`/comments/${req.params.id}`);
        res.json(response.data);
    } catch (error) {
        console.error('Comments API Error:', error.message);
        res.json({ comments: [] });
    }
});

app.get('/api/shorts', async (req, res) => {
    try {
        const response = await fetchFromFastestInstance('/trending?region=JP');
        const data = response.data.map(video => {
            const v = injectYoutubeThumbnails(video);
            return {
                videoId: v.videoId,
                title: v.title,
                author: v.author,
                authorThumbnail: v.authorThumbnails ? v.authorThumbnails.url : ""
            };
        });
        res.json(data);
    } catch (error) {
        console.error('Shorts API Error:', error.message);
        res.status(500).json({ error: 'Shortsフィードの取得に失敗しました。' });
    }
});

app.get('/api/stream', async (req, res) => {
    const videoId = req.query.v;
    if (!videoId) return res.status(400).send('Video ID is required');

    try {
        const response = await fetchFromFastestInstance(`/videos/${videoId}`);
        const data = response.data;
        
        const format = data.formatStreams ? data.formatStreams : null;
        
        if (format && format.url) {
            res.redirect(format.url);
        } else {
            throw new Error('Stream URL not found');
        }
    } catch (error) {
        console.error('Stream API Error:', error.message);
        res.status(500).send('ストリームの取得に失敗しました。');
    }
});

app.get('/api/siastream', async (req, res) => {
    const videoId = req.query.v;
    if (!videoId) return res.status(400).send('Video ID is required');

    try {
        const response = await axios.get(`https://siawaseok.f5.si/api/streams/${videoId}`);
        const data = response.data;

        const format18 = data.formatStreams.find(f => f.itag === "18" || f.itag === 18);

        if (format18 && format18.url) {
            res.redirect(format18.url);
        } else {
            const fallback = data.formatStreams;
            if (fallback && fallback.url) {
                res.redirect(fallback.url);
            } else {
                throw new Error('Stream URL not found');
            }
        }
    } catch (error) {
        console.error('SiaStream API Error:', error.message);
        res.status(500).send('ストリームの取得に失敗しました。');
    }
});

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
    res.sendFile(__dirname + '/public/history.html');
});

app.listen(PORT, () => {
    console.log('\n=========================================');
    console.log('    仙人チューブ NEXT サーバー起動完了');
    console.log('    (最速インスタンス自動選択モード実行中)');
    console.log(`    動作URL: http://localhost:${PORT}`);
    console.log('=========================================\n');
});
