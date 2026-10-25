const mongoose = require('mongoose');

const questionLibrarySchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true }, 
  currentVersionId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionVersion' }, 
  sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], 
}, { timestamps: true });

module.exports = mongoose.model('QuestionLibrary', questionLibrarySchema);