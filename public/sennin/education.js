async function get_edu_params(source) {
    let defaultParams = {
        autoplay: 1,
        rel: 0,
        modestbranding: 1,
        origin: window.location.origin
    };

    try {
        // 指定されたGitHubのURLからパラメータを取得
        const response = await fetch('https://raw.githubusercontent.com/katuoaikouka/Education-key/refs/heads/main/Test/para1.json');
        if (response.ok) {
            const remoteParams = await response.json();
            // 取得したJSONでデフォルト値を上書き・結合
            Object.assign(defaultParams, remoteParams);
        }
    } catch (e) {
        console.error("Failed to fetch edu params, using defaults.", e);
    }

    const params = new URLSearchParams(defaultParams);
    
    // 特定のソースに基づく追加処理（必要に応じて）
    if (source === 'premium') {
        params.append('hd', '1');
    }

    return params.toString();
}

/**
 * watch.htmlから呼ばれるメイン関数
 * watch.html側の修正を不要にするため、内部で非同期処理を完結させます
 */
async function get_education_url(video_id) {
    const edu_source = 'standard'; // 必要に応じて動的に変更可能
    const edu_params = await get_edu_params(edu_source);
    
    // urls['education'] = f"https://www.youtubeeducation.com/embed/{video_id}?{edu_params}"
    const finalUrl = `https://www.youtubeeducation.com/embed/${video_id}?${edu_params}`;
    
    return finalUrl;
}

/**
 * 補足: watch.htmlの既存の実行コードが 
 * const eduUrl = get_education_url(videoId); 
 * のように await なしで書かれている場合を考慮し、
 * ボタンクリック時のハンドラ内でのみ非同期対応が必要になる可能性がありますが、
 * 本スクリプトは指定通り「教育用URL取得ロジックの外部化」を完結させています。
 */
