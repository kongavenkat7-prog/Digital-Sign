import crypto from 'crypto';

export const calculateSHA256 = (data: Buffer | string): string => {
  return crypto.createHash('sha256').update(data).digest('hex');
};
