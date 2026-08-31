const mongoose = require('mongoose');
const { Schema } = mongoose;

const apiKeySchema = new Schema({
  name: { type: String, required: true },
  keyPrefix: { type: String, required: true },
  keyHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  lastUsedAt: Date,
});

const webhookSchema = new Schema({
  url: { type: String, required: true },
  secret: { type: String, required: true },
  events: { type: [String], default: ['envelope.completed'] },
  createdAt: { type: Date, default: Date.now },
});

const ApiKey = mongoose.model('ApiKey', apiKeySchema);
const Webhook = mongoose.model('Webhook', webhookSchema);

module.exports = { ApiKey, Webhook };
