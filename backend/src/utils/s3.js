const AWS = require('aws-sdk');

const s3Region = process.env.AWS_REGION || 'us-east-1';

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: s3Region,
});

const s3BucketName = process.env.S3_BUCKET_NAME || 'signvault-documents';

/**
 * Calls AWS directly at startup so config problems (wrong bucket, wrong
 * region, bad credentials) show up immediately in the server log instead of
 * only surfacing on the first upload attempt.
 */
const verifyS3Config = async () => {
  const keyPrefix = (process.env.AWS_ACCESS_KEY_ID || '').slice(0, 6) || 'MISSING';
  console.log(`🪣 S3 config -> region: ${s3Region}, bucket: ${s3BucketName}, accessKeyPrefix: ${keyPrefix}`);

  try {
    await s3.headBucket({ Bucket: s3BucketName }).promise();
    console.log(`✅ S3 bucket "${s3BucketName}" is reachable with the current credentials`);
  } catch (error) {
    console.error(
      `❌ S3 check failed for bucket "${s3BucketName}" in region "${s3Region}": [${error.code}] ${error.message}`
    );
  }
};

const uploadToS3 = async (key, body, contentType) => {
  const params = {
    Bucket: s3BucketName,
    Key: key,
    Body: body,
    ContentType: contentType,
    ServerSideEncryption: 'AES256',
    Metadata: {
      'upload-date': new Date().toISOString(),
    },
  };

  try {
    const result = await s3.upload(params).promise();
    return result.Location;
  } catch (error) {
    console.error('S3 upload error:', error);
    throw new Error('Failed to upload to S3: ' + error.message);
  }
};

const downloadFromS3 = async (key) => {
  const params = {
    Bucket: s3BucketName,
    Key: key,
  };

  try {
    const data = await s3.getObject(params).promise();
    return data.Body;
  } catch (error) {
    console.error('S3 download error:', error);
    throw new Error('Failed to download from S3: ' + error.message);
  }
};

module.exports = { uploadToS3, downloadFromS3, verifyS3Config, s3BucketName, default: s3 };
