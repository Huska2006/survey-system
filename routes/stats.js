const router = require('express').Router();
const mongoose = require('mongoose'); // 需要用到 ObjectId
const Survey = require('../models/Survey');
const Question = require('../models/Question');
const Response = require('../models/Response');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

// 查看单个问卷的统计（旧功能保留）
router.get('/:id', async (req, res) => {
  const survey = await Survey.findById(req.params.id);
  if (!survey) return res.status(404).json({ error: '问卷不存在' });
  if (survey.ownerId.toString() !== req.userId.toString()) return res.status(403).json({ error: '无权访问' });

  const questions = await Question.find({ surveyId: survey._id }).sort({ order: 1 });
  const total = await Response.countDocuments({ surveyId: survey._id });
  const result = { total, questions: [] };

  for (const q of questions) {
    result.questions.push(await statsForQuestion(survey._id, q));
  }
  res.json(result);
});

// 第二阶段新增：跨问卷统计某个题库模板
router.get('/template/:templateId', async (req, res) => {
  const templateId = new mongoose.Types.ObjectId(req.params.templateId);
  
  const stats = await Response.aggregate([
    { $unwind: '$answers' },
    { $match: { 'answers.templateId': templateId } },
    { $group: { _id: '$answers.value', count: { $sum: 1 } } }
  ]);
  
  res.json({ 
    templateId, 
    totalAnswers: stats.reduce((a, b) => a + b.count, 0), 
    stats 
  });
});

async function statsForQuestion(surveyId, question) {
  const base = { id: question._id, title: question.title, type: question.type };

  if (question.type === 'single') {
    const rows = await Response.aggregate([
      { $match: { surveyId } },
      { $unwind: { path: '$answers', preserveNullAndEmptyArrays: true } },
      { $match: { 'answers.questionId': question._id } },
      { $group: { _id: '$answers.value', count: { $sum: 1 } } },
    ]);
    return { ...base, options: rows };
  }

  if (question.type === 'multiple') {
    const rows = await Response.aggregate([
      { $match: { surveyId } },
      { $unwind: { path: '$answers', preserveNullAndEmptyArrays: true } },
      { $match: { 'answers.questionId': question._id } },
      { $unwind: { path: '$answers.value', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$answers.value', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    return { ...base, options: rows };
  }

  if (question.type === 'number') {
    const rows = await Response.aggregate([
      { $match: { surveyId } },
      { $unwind: { path: '$answers', preserveNullAndEmptyArrays: true } },
      { $match: { 'answers.questionId': question._id, 'answers.value': { $type: 'number' } } },
      { $group: { _id: null, avg: { $avg: '$answers.value' }, count: { $sum: 1 } } },
    ]);
    return { ...base, average: rows[0]?.avg ?? null, count: rows[0]?.count ?? 0 };
  }

  if (question.type === 'text') {
    const rows = await Response.find({ surveyId, 'answers.questionId': question._id }, { 'answers.$': 1 });
    return { ...base, values: rows.map(r => r.answers[0]?.value) };
  }

  return base;
}

module.exports = router;