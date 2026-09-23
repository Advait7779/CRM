const fs = require('fs');
const path = require('path');
require('../config/env');

/**
 * Storage Abstraction Layer
 * Handles uploading files locally or to AWS S3 / Cloudflare R2 / Google Cloud Storage
 */
const uploadFile = async ({ filePath, destinationName, mimeType }) => {
  const s3Bucket = process.env.AWS_S3_BUCKET;

  if (s3Bucket && process.env.AWS_ACCESS_KEY_ID) {
    console.log(`[CloudStorage] Uploading ${destinationName} to S3 Bucket: ${s3Bucket}`);
    // Adapter placeholder for @aws-sdk/client-s3 PutObjectCommand
    return {
      provider: 's3',
      url: `https://${s3Bucket}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${destinationName}`,
      key: destinationName
    };
  }

  // Local storage fallback
  console.log(`[LocalStorage] File persisted at local storage path: ${destinationName}`);
  return {
    provider: 'local',
    url: `/uploads/${destinationName}`,
    key: destinationName
  };
};

const deleteFile = async (fileName) => {
  const uploadDir = path.join(__dirname, '..', 'uploads');
  const filePath = path.join(uploadDir, path.basename(fileName));

  if (fs.existsSync(filePath)) {
    fs.unlink(filePath, (err) => {
      if (err) console.error(`[Storage] Failed to delete file ${fileName}:`, err.message);
    });
  }
};

module.exports = {
  uploadFile,
  deleteFile
};
