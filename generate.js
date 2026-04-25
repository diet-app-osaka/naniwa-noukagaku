require('dotenv').config();
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const Jimp = require('jimp');

const API_KEY = process.env.STABILITY_API_KEY;
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzvPyTQIKrGke7_lse8Hyu24KZF7XG36aTx6c89RTiVQ75TzeKknK0NUXBtj9i32y4biQ/exec";

if (!API_KEY) {
    console.error("STABILITY_API_KEY is not set in .env file.");
    process.exit(1);
}

// Googleドライブへのアップロード関数
async function uploadToDrive(filePath, filename) {
    console.log(`      [Drive] ${filename} をアップロード中...`);
    try {
        const base64 = fs.readFileSync(filePath, {encoding: 'base64'});
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
}

// 難易度別の設定
// difficulty: 1 (初級), 2 (中級), 3 (上級)
function getRandomRegions(imgWidth, imgHeight, count, difficulty) {
    const regions = [];
    let sizeRatio;
    if (difficulty === 1) sizeRatio = 0.15; // 初級：画像の15%程度の大きさ
    else if (difficulty === 2) sizeRatio = 0.08; // 中級：画像の8%程度の大きさ
    else sizeRatio = 0.04; // 上級：画像の4%程度の大きさ

    const baseSize = Math.floor(Math.min(imgWidth, imgHeight) * sizeRatio);
    let attempts = 0;
    
    while (regions.length < count && attempts < 1000) {
        attempts++;
        const w = Math.floor(baseSize * (0.8 + Math.random() * 0.4));
        const h = Math.floor(baseSize * (0.8 + Math.random() * 0.4));
        // マージンを少し取る
        const margin = Math.floor(baseSize * 0.5);
        const x = Math.floor(margin + Math.random() * (imgWidth - w - margin * 2));
        const y = Math.floor(margin + Math.random() * (imgHeight - h - margin * 2));

        let overlap = false;
        for (const r of regions) {
            // かなり余裕を持たせて被り判定
            const padding = baseSize;
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
    const prefix = `level_${difficulty}`;
    
    // 1. ベース画像の生成
    console.log("[1/4] ベース画像を生成中...");
    const baseRes = await axios.post(
        'https://api.stability.ai/v2beta/stable-image/generate/core',
        axios.toFormData({
            prompt: "A highly detailed, colorful, isometric illustration of a quirky brain science laboratory desk. Stacks of books, a glowing brain in a glass jar, a microscope, a vintage clock, and scattered notes. Bright lighting, engaging and fun atmosphere, perfect for a spot-the-difference puzzle game.",
            output_format: "png"
        }),
        {
            headers: { 'Authorization': `Bearer ${API_KEY}`, 'Accept': 'image/*' },
            responseType: 'arraybuffer'
        }
    );
    const basePath = `${prefix}_base.png`;
    fs.writeFileSync(basePath, baseRes.data);
    await uploadToDrive(basePath, basePath);
    
    // 画像サイズを取得
    const baseImg = await Jimp.read(basePath);
    const width = baseImg.bitmap.width;
    const height = baseImg.bitmap.height;
    console.log(`      -> 生成完了: ${width}x${height}`);

    // 2. マスクの生成 (8箇所)
    console.log("[2/4] マスク画像を生成中...");
    const maskImg = new Jimp(width, height, 0x000000FF);
    const regions = getRandomRegions(width, height, 8, difficulty);
    const colorWhite = Jimp.rgbaToInt(255, 255, 255, 255);
    
    for(const [rx, ry, rw, rh] of regions) {
        for(let x = rx; x < rx + rw; x++) {
            for(let y = ry; y < ry + rh; y++) {
                if(x >= 0 && x < width && y >= 0 && y < height) {
                    maskImg.setPixelColor(colorWhite, x, y);
                }
            }
        }
    }
    const maskPath = `${prefix}_mask.png`;
    await maskImg.writeAsync(maskPath);

    // 3. インペイント（間違いの作成）
    console.log("[3/4] 間違い画像を生成中（インペイント）...");
    const inpaintData = new FormData();
    inpaintData.append('image', fs.createReadStream(basePath));
    inpaintData.append('mask', fs.createReadStream(maskPath));
    inpaintData.append('prompt', "different objects, changed colors, strange things, items missing, surreal details");
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
    fs.writeFileSync(mistakePath, inpaintRes.data);
    await uploadToDrive(mistakePath, mistakePath);

    // 4. 赤丸の描画（答え合わせ画像）
    console.log("[4/4] 答え合わせ画像を生成中...");
    const answerImg = await Jimp.read(basePath);
    const colorRed = Jimp.rgbaToInt(255, 0, 0, 255);
    const thickness = Math.max(3, Math.floor(width * 0.005)); // 解像度に応じた太さ

    for(const [rx, ry, rw, rh] of regions) {
        const cx = rx + rw / 2;
        const cy = ry + rh / 2;
        // マスクより少し大きめの円を描く
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
    await uploadToDrive(answerPath, answerPath);
    
    console.log(`-> ${levelName} の作成とアップロード完了！`);
}

async function run() {
    try {
        await generateImages(1, "初級");
        await generateImages(2, "中級");
        // テストのためまずは初級・中級のみ（API節約）
        console.log("\n全ての生成が完了しました！");
    } catch (err) {
        if(err.response) {
            console.error("API Error:", err.response.status, err.response.data.toString());
        } else {
            console.error("Error:", err);
        }
    }
}

run();
