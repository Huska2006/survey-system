const mongoose = require('mongoose');

const responseSchema = new mongoose.Schema({
  surveyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Survey', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  submittedAt: { type: Date, default: Date.now },
  answers: [
    {
      questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
      templateId: { type: mongoose.Schema.Types.ObjectId, default: null }, // 新增
      type: { type: String, required: true },
      value: { type: mongoose.Schema.Types.Mixed, default: null },
    },
  ],
});

responseSchema.index({ surveyId: 1, submittedAt: -1 });
responseSchema.index({ 'answers.questionId': 1 });
responseSchema.index({ 'answers.templateId': 1 }); // 新增：加速跨问卷统计

module.exports = mongoose.model('Response', responseSchema);