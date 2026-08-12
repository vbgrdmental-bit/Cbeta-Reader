/**
 * High-speed Batch Uploader for Cloudflare R2 (CBETA Backup JSON Files)
 * 
 * Usage:
 *   node scripts/upload-to-r2.cjs <ACCESS_KEY_ID> <SECRET_ACCESS_KEY> [ACCOUNT_ID] [BUCKET_NAME]
 */

const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const accessKeyId = process.env.R2_ACCESS_KEY_ID || process.argv[2];
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || process.argv[3];
const accountId = process.env.R2_ACCOUNT_ID || process.argv[4] || '1834e1648c607ada38a96db4b31f7bc2';
const bucketName = process.env.R2_BUCKET || process.argv[5] || 'cbeta-r2-backup';

if (!accessKeyId || !secretAccessKey) {
  console.error('\n❌ 缺少 Cloudflare R2 API 金鑰金鑰憑證！');
  console.error('\n請提供 R2 Access Key ID 與 Secret Access Key：');
  console.error('用法: node scripts/upload-to-r2.cjs <ACCESS_KEY_ID> <SECRET_ACCESS_KEY>\n');
  process.exit(1);
}

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

const SOURCE_DIR = path.join(__dirname, '../dist-r2-backup');

function getAllFiles(dirPath, arrayOfFiles = []) {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else if (file.endsWith('.json')) {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

async function startUpload() {
  console.log(`\n🚀 [CBETA R2 批次上傳引擎] 正在掃描待上傳備援經文檔...`);
  console.log(`📁 來源目錄: ${SOURCE_DIR}`);
  console.log(`🪣 目標 R2 貯體: ${bucketName}`);
  console.log(`🌐 帳號 ID: ${accountId}`);

  const allFiles = getAllFiles(SOURCE_DIR);
  const totalFiles = allFiles.length;

  if (totalFiles === 0) {
    console.error(`❌ 未在 ${SOURCE_DIR} 找到任何 JSON 備援檔案。請先執行 npm run package:r2`);
    process.exit(1);
  }

  console.log(`\n📦 共找到 ${totalFiles} 個經文 JSON 檔案，啟動 40 線程極速平行上傳作業...\n`);

  const CONCURRENCY = 40;
  let completed = 0;
  let failed = 0;
  const startTime = Date.now();

  const fileQueue = [...allFiles];

  async function worker() {
    while (fileQueue.length > 0) {
      const filePath = fileQueue.shift();
      if (!filePath) break;

      const relativePath = path.relative(SOURCE_DIR, filePath).replace(/\\/g, '/');

      try {
        const fileBuffer = fs.readFileSync(filePath);
        const command = new PutObjectCommand({
          Bucket: bucketName,
          Key: relativePath,
          Body: fileBuffer,
          ContentType: 'application/json',
          CacheControl: 'public, max-age=31536000, immutable',
        });

        await s3Client.send(command);
        completed++;
      } catch (err) {
        failed++;
        console.error(`\n❌ 上傳失敗: ${relativePath}`, err.message);
      }

      if ((completed + failed) % 100 === 0 || (completed + failed) === totalFiles) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = (completed / elapsed).toFixed(1);
        const percent = (((completed + failed) / totalFiles) * 100).toFixed(1);
        const remSec = Math.ceil((totalFiles - (completed + failed)) / parseFloat(rate || 1));
        const remMin = (remSec / 60).toFixed(1);

        process.stdout.write(
          `\r[進度 ${percent}%] 已上傳: ${completed}/${totalFiles} (失敗: ${failed}) | 速度: ${rate} 檔/秒 | 預估剩餘: ${remMin} 分鐘`
        );
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n\n🎉 [成功完成] ${completed} 個 CBETA 全集經文檔已成功上傳至 Cloudflare R2！`);
  console.log(`⏱️ 總耗時: ${totalTime} 秒。`);
}

startUpload().catch((err) => {
  console.error('\n❌ 上傳過渡發生嚴重錯誤:', err);
  process.exit(1);
});
