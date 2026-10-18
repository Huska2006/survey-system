const mongoose = require('mongoose');

const surveySchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    allowAnonymous: { type: Boolean, default: false },
    status: { type: String, enum: ['draft', 'published', 'closed'], default: 'draft' },
    deadline: { type: Date, default: null },
    slug: { type: String, required: true, unique: true, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Survey', surveySchema);