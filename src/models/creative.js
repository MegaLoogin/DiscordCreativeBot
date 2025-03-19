const mongoose = require('mongoose');

const creativeSchema = new mongoose.Schema({
  buyerId: { type: String, required: true },
  buyerName: { type: String, required: true },
  teamLeadId: { type: String, required: true },
  images: [{ type: String, required: true }],
  description: { type: String, required: true },
  messageId: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Creative', creativeSchema);