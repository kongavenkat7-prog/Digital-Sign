import AWS from 'aws-sdk';

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
});

export const s3BucketName = process.env.S3_BUCKET_NAME || 'signvault-documents';

export const uploadToS3 = async (key: string, body: Buffer, contentType: string): Promise<string> => {
  const params: any = {
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
    throw new Error('Failed to upload to S3: ' + (error as any).message);
  }
};

export const downloadFromS3 = async (key: string): Promise<Buffer> => {
  const params: any = {
    Bucket: s3BucketName,
    Key: key,
  };

  try {
    const data = await s3.getObject(params).promise();
    return data.Body as Buffer;
  } catch (error) {
    console.error('S3 download error:', error);
    throw new Error('Failed to download from S3: ' + (error as any).message);
  }
};

export default s3;
