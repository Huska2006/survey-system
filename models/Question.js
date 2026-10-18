const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  surveyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Survey', required: true, index: true },
  order: { type: Number, required: true },
  type: { type: String, enum: ['single', 'multiple', 'text', 'number'], required: true },
  title: { type: String, required: true },
  required: { type: Boolean, default: false },

  // 单选 / 多选的选项
  options: [{ key: String, label: String }],

  // 多选限制
  selectLimit: {
    min: { type: Number, default: null },
    max: { type: Number, default: null },
  },

  // 文本限制
  textLimit: {
    minLength: { type: Number, default: null },
    maxLength: { type: Number, default: null },
  },

  // 数字限制
  numberLimit: {
    min: { type: Number, default: null },
    max: { type: Number, default: null },
    integerOnly: { type: Boolean, default: false },
  },

  // 跳转规则（数据化，不写死在代码里）
  jumpRules: [
    {
      when: {
        optionKey: { type: String, default: null }, // 单选/多选跳转
        operator: { type: String, default: null },  // 数字跳转 (>, <, ==)
        value: { type: Number, default: null },
      },
      targetQuestionId: { type: mongoose.Schema.Types.ObjectId },
    },
  ],
});

questionSchema.index({ surveyId: 1, order: 1 });

module.exports = mongoose.model('Question', questionSchema);