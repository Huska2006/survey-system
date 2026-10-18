const mongoose = require('mongoose');

const responseSchema = new mongoose.Schema({
  surveyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Survey', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  submittedAt: { type: Date, default: Date.now },
  answers: [
    {
      questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
      type: { type: String, required: true },
      value: { type: mongoose.Schema.Types.Mixed, default: null }, // Mixed 允许存字符串、数组或数字
    },
  ],
});

responseSchema.index({ surveyId: 1, submittedAt: -1 });
responseSchema.index({ 'answers.questionId': 1 });

module.exports = mongoose.model('Response', responseSchema);