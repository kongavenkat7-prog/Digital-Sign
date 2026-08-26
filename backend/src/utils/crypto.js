const crypto = require('crypto');

const calculateSHA256 = (data) => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

module.exports = { calculateSHA256 };
