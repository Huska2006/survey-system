const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  surveyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Survey', required: true, index: true },
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionLibrary', default: null },
  versionId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionVersion', default: null },
  
  order: { type: Number, required: true },
  type: { type: String, enum: ['single', 'multiple', 'text', 'number'], required: true },
  title: { type: String, required: true },
  required: { type: Boolean, default: false },

  options: [{ key: String, label: String }],
  selectLimit: { min: { type: Number, default: null }, max: { type: Number, default: null } },
  textLimit: { minLength: { type: Number, default: null }, maxLength: { type: Number, default: null } },
  numberLimit: { min: { type: Number, default: null }, max: { type: Number, default: null }, integerOnly: { type: Boolean, default: false } },

  jumpRules: [
    {
      when: {
        optionKey: { type: String, default: null },
        operator: { type: String, default: null },
        value: { type: Number, default: null },
      },
      targetQuestionId: { type: mongoose.Schema.Types.ObjectId },
    },
  ],
});

questionSchema.index({ surveyId: 1, order: 1 });

module.exports = mongoose.model('Question', questionSchema);