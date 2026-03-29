const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

// サーバーのポート設定
const PORT = process.env.PORT || 3000;

// 使用するInvidiousインスタンスのベースURL
// インスタンスがダウンしている場合は https://docs.invidious.io/instances/ から別なものを選択してください
const INVIDIOUS_API = 'https://invidious.f5.si/api/v1';

// 静的ファイル（HTML, CSS, JS）を public フォルダから配信
app.use(express.static(path.join(__dirname, 'public')));

/**
 * 1. トレンド動画取得 API
 * ホーム画面 (index.html) の初期表示で使用
 */
app.get('/api/trending', async (req, res) => {
    try {
        const response = await axios.get(`${INVIDIOUS_API}/trending?region=JP`, {
            timeout: 5000 // 5秒でタイムアウト設定
        });
        res.json(response.data);
    } catch (error) {
        console.error('Trending API Error:', error.message);
        res.status(500).json({ error: 'トレンド動画の取得に失敗しました。' });
    }
});

/**
 * 2. 動画検索 API
 * 検索結果画面 (search.html) で使用
 */
app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (!query) {
        return res.status(400).json({ error: '検索クエリが空です。' });
    }

    try {
        const response = await axios.get(`${INVIDIOUS_API}/search?q=${encodeURIComponent(query)}&region=JP`, {
            timeout: 5000
        });
        res.json(response.data);
    } catch (error) {
        console.error('Search API Error:', error.message);
        res.status(500).json({ error: '検索の実行中にエラーが発生しました。' });
    }
});

/**
 * 3. 検索サジェスト API
 * 検索バーの入力補完（オートコンプリート）で使用
 */
app.get('/api/suggestions', async (req, res) => {
    const query = req.query.q;
    if (!query) {
        return res.json([]);
    }

    try {
        // YouTube公式のサジェストエンドポイント（JSONP形式をパース）
        const url = `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&hl=ja&q=${encodeURIComponent(query)}`;
        const response = await axios.get(url);
        
        // レスポンス例: window.google.ac.h(["query",[["suggestion1",0],["suggestion2",0]]])
        // 上記のような文字列から配列部分のみを抽出してパースする
        const match = response.data.match(/\((.*)\)/);
        if (match) {
            const data = JSON.parse(match[1]);
            const suggestions = data[1].map(item => item[0]);
            res.json(suggestions);
        } else {
            res.json([]);
        }
    } catch (error) {
        console.error('Suggestions API Error:', error.message);
        res.json([]); // サジェストの失敗はユーザー体験を阻害しないよう空配列を返す
    }
});

/**
 * 4. 動画詳細情報取得 API
 * 再生画面 (watch.html) で動画情報を表示するために使用
 */
app.get('/api/video/:id', async (req, res) => {
    const videoId = req.params.id;
    try {
        const response = await axios.get(`${INVIDIOUS_API}/videos/${videoId}`, {
            timeout: 5000
        });
        res.json(response.data);
    } catch (error) {
        console.error('Video Detail API Error:', error.message);
        res.status(500).json({ error: '動画詳細の取得に失敗しました。' });
    }
});

/**
 * 5. HTMLルーティング
 * 拡張子なしでのアクセスを許可し、適切なファイルを返却
 */

// ホーム (index.html)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// 検索結果 (search.html)
app.get('/search', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/search.html'));
});

// 再生画面 (watch.html)
app.get('/watch', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/watch.html'));
});

// Shorts (shorts.html) - iframe用
app.get('/shorts', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/shorts.html'));
});

/**
 * サーバー起動
 */
app.listen(PORT, () => {
    console.log('\n=========================================');
    console.log('   仙人チューブ NEXT サーバー起動完了');
    console.log(`   動作URL: http://localhost:${PORT}`);
    console.log('=========================================\n');
});
