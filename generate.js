require('dotenv').config();
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const Jimp = require('jimp');

const API_KEY = process.env.STABILITY_API_KEY;
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzvPyTQIKrGke7_lse8Hyu24KZF7XG36aTx6c89RTiVQ75TzeKknK0NUXBtj9i32y4biQ/exec";

const THEMES = [
    "天空の占星術塔: 巨大な天球儀と星図、動く望遠鏡がある。",
    "氷の魔術師の書斎: 家具がすべて氷でできており、冷たい霧が漂う。",
    "砂漠の遺跡キャンプ: 古代の石碑を解読するためのテント。",
    "ドラゴンの巣の鑑定所: 財宝と巨大な骨に囲まれた鑑定士の作業場。",
    "陰陽師の結界部屋: 浮遊する御札と大きな筆、墨の香りが漂う空間。",
    "中世の写本室: ろうそくの火が揺れる中、羊皮紙に緻密な絵を描く部屋。",
    "巨人の台所: すべてが巨大な, 巨大生物のための調理場兼実験場。",
    "魔女のハーブ乾燥室: 天井から数千の乾燥植物が吊るされた部屋。",
    "地下墓地の祭壇: 骸骨と紫の炎、不気味な儀式道具が並ぶ場所。",
    "飛行船の操縦室: 雲の上を飛ぶ船の、真鍮と革張りのコックピット。",
    "錬金術師の地下貯蔵庫: 液体が脈動する巨大なフラスコが並ぶ。",
    "アトランティスの神殿: 沈没した都市にある、光るクリスタルの動力源。",
    "ノームの時計修理工房: 小さな歯車が壁一面に敷き詰められた部屋。",
    "鏡の魔術師の部屋: 無数の合わせ鏡があり、別の世界が映っている。",
    "妖精の鍛冶場: 蛍の光で照らされた、花びらで作られた金槌がある場所。",
    "バビロンの空中庭園ラボ: 垂直に流れる水と珍しい熱帯植物の研究室。",
    "忍者のからくり屋敷: 壁が回転し、隠し武器が仕込まれた訓練場。",
    "廃墟のハッカーアジト: 瓦礫の中に古いモニターと配線が散乱している。",
    "アンドロイド修復工場: 吊り下げられた機械の腕と、解体された義体。",
    "衛星軌道上の展望ラウンジ: 地球を眼下に見下ろすガラス張りの部屋。",
    "スペースデブリの回収船: 宇宙のゴミを分解する、無骨なクレーンのある部屋。",
    "クローン培養センター: 緑色の液体の中に浮かぶ生命体のカプセル。",
    "ネオ東京の屋台裏: 濡れたアスファルトとホログラム看板の光。",
    "巨大キノコの村の診療所: キノコの傘の下にある、胞子が舞う薬局。",
    "深海の人魚の宮殿: 珊瑚の椅子と、真珠の照明がある部屋。",
    "樹齢千年の樹内図書館: 木の幹の中に彫られた、本棚と木の階段。",
    "滝の裏の隠れ家: 水のカーテン越しに光が差し込む石室。 ",
    "おもちゃの病院: 壊れたぬいぐるみが手術を待っている工房。",
    "昭和の秘密基地: 段ボールの壁, 漫画, 古いラジオ。",
    "ジャズの流れる深夜のバー: 琥珀色のグラスと、レコードプレーヤー。",
    "お菓子の城のパティスリー: チョコのレンガと、キャンディの窓。",
    "猫が経営するティーサロン: 猫用の小さな家具と、肉球クッキー。",
    "重力が逆転した部屋: 天井に家具が配置され、床が空。",
    "香水調合師のラボ: 数千のガラス瓶と、目に見える香りの霧。"
];

if (!API_KEY) {
    console.error("STABILITY_API_KEY is not set in .env file.");
    process.exit(1);
}

// Googleドライブへのアップロード関数 (1080x1080 インスタ用に白枠を追加)
async function uploadToDrive(filePath, filename) {
    console.log(`      [Format] Instagram用に1080x1080の白枠を追加中...`);
    
    // 画像を1000x1000に縮小し、1080x1080の白キャンバスの中央に配置
    const img = await Jimp.read(filePath);
    img.resize(1000, 1000);
    const canvas = new Jimp(1080, 1080, 0xFFFFFFFF);
    canvas.composite(img, 40, 40);
    
    const formattedPath = filePath.replace('.png', '_ig.png');
    await canvas.writeAsync(formattedPath);

    console.log(`      [Drive] ${filename} をアップロード中...`);
    try {
        const base64 = fs.readFileSync(formattedPath, {encoding: 'base64'});
        const res = await axios.post(GAS_WEB_APP_URL, {
            filename: filename,
            base64: base64
        }, {
            headers: { 'Content-Type': 'application/json' }
        });
        if (res.data && res.data.status === 'success') {
            console.log(`      -> ドライブ保存成功: ${res.data.url}`);
        } else {
            console.error(`      -> ドライブ保存失敗:`, res.data);
        }
    } catch(err) {
        console.error(`      -> アップロードエラー:`, err.message);
    }
    
    // アップロード用の一時ファイルを削除
    if (fs.existsSync(formattedPath)) {
        fs.unlinkSync(formattedPath);
    }
}

function getRandomRegions(imgWidth, imgHeight, count, difficulty) {
    const regions = [];
    let sizeRatio;
    if (difficulty === 1) sizeRatio = 0.06; // さらに小さくして精度アップ
    else if (difficulty === 2) sizeRatio = 0.04; 
    else sizeRatio = 0.025; 

    const baseSize = Math.floor(Math.min(imgWidth, imgHeight) * sizeRatio);
    let attempts = 0;
    
    while (regions.length < count && attempts < 1000) {
        attempts++;
        const w = Math.floor(baseSize * (0.8 + Math.random() * 0.4));
        const h = Math.floor(baseSize * (0.8 + Math.random() * 0.4));
        const margin = Math.floor(baseSize * 0.5);
        const x = Math.floor(margin + Math.random() * (imgWidth - w - margin * 2));
        const y = Math.floor(margin + Math.random() * (imgHeight - h - margin * 2));

        let overlap = false;
        for (const r of regions) {
            const padding = baseSize * 1.5;
            if (x - padding < r[0] + r[2] && x + w + padding > r[0] && 
                y - padding < r[1] + r[3] && y + h + padding > r[1]) {
                overlap = true;
                break;
            }
        }
        if (!overlap) {
            regions.push([x, y, w, h]);
        }
    }
    return regions;
}

async function generateImages(difficulty, levelName) {
    console.log(`\n=== 難易度: ${levelName} の生成を開始 ===`);
    const timestamp = new Date().getTime();
    const prefix = `level_${difficulty}_${timestamp}`;
    
    let count;
    let levelLabel;
    if (difficulty === 1) {
        count = 3 + Math.floor(Math.random() * 3);
        levelLabel = "【初級】";
    } else if (difficulty === 2) {
        count = 6 + Math.floor(Math.random() * 3);
        levelLabel = "【中級】";
    } else {
        count = 10 + Math.floor(Math.random() * 3);
        levelLabel = "【上級】";
    }
    
    console.log("[1/4] ベース画像を生成中...");
    const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
    console.log(`      -> 選ばれたテーマ: ${theme}`);

    const baseRes = await axios.post(
        'https://api.stability.ai/v2beta/stable-image/generate/core',
        axios.toFormData({
            prompt: `A simple 2D flat illustration of ${theme}. Kawaii cartoon style, bold black outlines, bright solid colors, clear and simple composition, white background, high contrast, children's book style.`,
            output_format: "png"
        }),
        {
            headers: { 'Authorization': `Bearer ${API_KEY}`, 'Accept': 'image/*' },
            responseType: 'arraybuffer'
        }
    );
    const basePath = `${prefix}_base.png`;
    fs.writeFileSync(basePath, Buffer.from(baseRes.data));
    
    const baseImg = await Jimp.read(basePath);
    const width = baseImg.bitmap.width;
    const height = baseImg.bitmap.height;
    console.log(`      -> 生成完了: ${width}x${height}`);

    await uploadToDrive(basePath, `${levelLabel}_${timestamp}_base.png`);

    // 2. マスクの生成 (ガタガタの形状にして強力にぼかす)
    console.log(`[2/4] マスク画像を生成中（間違いの数: ${count}）...`);
    const maskImg = new Jimp(width, height, 0x000000FF);
    const regions = getRandomRegions(width, height, count, difficulty);
    const colorWhite = Jimp.rgbaToInt(255, 255, 255, 255);
    
    for(const [rx, ry, rw, rh] of regions) {
        const cx = rx + rw / 2;
        const cy = ry + rh / 2;
        const radius = Math.max(rw, rh) / 2;
        
        for(let x = Math.floor(cx - radius * 1.2); x <= Math.ceil(cx + radius * 1.2); x++) {
            for(let y = Math.floor(cy - radius * 1.2); y <= Math.ceil(cy + radius * 1.2); y++) {
                // ランダムなノイズを加えて形を歪ませる
                const noise = Math.random() * 0.3;
                const dist = Math.sqrt((x-cx)*(x-cx) + (y-cy)*(y-cy));
                if(dist <= radius * (1 + noise)) {
                    if(x >= 0 && x < width && y >= 0 && y < height) {
                        maskImg.setPixelColor(colorWhite, x, y);
                    }
                }
            }
        }
    }
    // 強力にぼかして形を消す
    maskImg.blur(15);
    const maskPath = `${prefix}_mask.png`;
    await maskImg.writeAsync(maskPath);

    console.log("[3/4] 間違い画像を生成中（インペイント）...");
    const inpaintData = new FormData();
    inpaintData.append('image', fs.createReadStream(basePath));
    inpaintData.append('mask', fs.createReadStream(maskPath));
    // 形状へのこだわりを捨てさせ、絵としての自然さを最優先させるプロンプト
    inpaintData.append('prompt', "A natural modification of the illustration. Change a small object or detail. Matches the art style perfectly. NO solid circles, NO solid squares, NO artificial shapes. Seamless textures only.");
    inpaintData.append('output_format', 'png');

    const inpaintRes = await axios.post(
        'https://api.stability.ai/v2beta/stable-image/edit/inpaint',
        inpaintData,
        {
            headers: { 'Authorization': `Bearer ${API_KEY}`, ...inpaintData.getHeaders(), 'Accept': 'image/*' },
            responseType: 'arraybuffer'
        }
    );
    const mistakePath = `${prefix}_mistake.png`;
    fs.writeFileSync(mistakePath, Buffer.from(inpaintRes.data));

    console.log("[4/4] 曖昧な間違いの除外と答え合わせ画像を生成中...");
    const mistakeImg = await Jimp.read(mistakePath);
    const answerImg = await Jimp.read(basePath);
    const colorRed = Jimp.rgbaToInt(255, 0, 0, 255);
    const thickness = Math.max(8, Math.floor(width * 0.01));

    const validRegions = [];
    for(const [rx, ry, rw, rh] of regions) {
        let diffSum = 0;
        for(let x = rx; x < rx + rw; x++) {
            for(let y = ry; y < ry + rh; y++) {
                if (x >= width || y >= height) continue;
                const c1 = Jimp.intToRGBA(baseImg.getPixelColor(x, y));
                const c2 = Jimp.intToRGBA(mistakeImg.getPixelColor(x, y));
                diffSum += Math.abs(c1.r - c2.r) + Math.abs(c1.g - c2.g) + Math.abs(c1.b - c2.b);
            }
        }
        const avgDiff = diffSum / (rw * rh * 3);
        console.log(`      -> 領域(${rx},${ry}) の変化量: ${avgDiff.toFixed(2)}`);
        
        // 閾値（15）未満の場合は、変化が小さすぎるとみなして弾く
        if (avgDiff > 15) {
            validRegions.push([rx, ry, rw, rh]);
        } else {
            console.log(`      -> [除外] 変化が小さいため、元の画像を貼り直して完全に同一にします。`);
            mistakeImg.blit(baseImg, rx, ry, rx, ry, rw, rh);
        }
    }

    if (validRegions.length === 0) {
        console.log("      -> [エラー] 有効な間違いが1つも生成されませんでした。このセットはスキップします。");
        return;
    }

    // クリーンになった間違い画像を保存＆アップロード
    await mistakeImg.writeAsync(mistakePath);
    await uploadToDrive(mistakePath, `${levelLabel}_${timestamp}_mistake.png`);

    // 答え合わせ画像には、弾かれなかった「明確な間違い」のみ赤丸をつける
    for(const [rx, ry, rw, rh] of validRegions) {
        const cx = rx + rw / 2;
        const cy = ry + rh / 2;
        const radius = Math.max(rw, rh) / 2 + (width * 0.02);

        for(let x = cx - radius - thickness; x <= cx + radius + thickness; x++) {
            for(let y = cy - radius - thickness; y <= cy + radius + thickness; y++) {
                const dist = Math.sqrt((x-cx)*(x-cx) + (y-cy)*(y-cy));
                if(dist >= radius - thickness && dist <= radius) {
                    if(x >= 0 && x < width && y >= 0 && y < height) {
                        answerImg.setPixelColor(colorRed, Math.round(x), Math.round(y));
                    }
                }
            }
        }
    }
    const answerPath = `${prefix}_answer.png`;
    await answerImg.writeAsync(answerPath);
    await uploadToDrive(answerPath, `${levelLabel}_${timestamp}_answer.png`);
    
    console.log(`-> ${levelName} の作成とアップロード完了！ (実際の間違い数: ${validRegions.length})`);
}

async function run() {
    try {
        // 各レベルを2セットずつ生成
        for (let i = 1; i <= 2; i++) {
            console.log(`\n--- 第 ${i} セットの生成開始 ---`);
            await generateImages(1, "初級");
            await generateImages(2, "中級");
            await generateImages(3, "上級");
        }
        console.log("\n本日の全ての生成が完了しました！");
    } catch (err) {
        if(err.response) {
            console.error("API Error:", err.response.status, err.response.data.toString());
        } else {
            console.error("Error:", err);
        }
    }
}

run();
