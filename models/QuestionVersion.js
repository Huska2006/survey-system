const mongoose = require('mongoose');

const questionVersionSchema = new mongoose.Schema({
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionLibrary', required: true, index: true },
  versionNumber: { type: Number, required: true }, 
  parentVersionId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionVersion', default: null }, 
  
  type: { type: String, enum: ['single', 'multiple', 'text', 'number'], required: true },
  options: [{ key: String, label: String }],
  selectLimit: { min: Number, max: Number },
  textLimit: { minLength: Number, maxLength: Number },
  numberLimit: { min: Number, max: Number, integerOnly: Boolean },
}, { timestamps: true });

module.exports = mongoose.model('QuestionVersion', questionVersionSchema);