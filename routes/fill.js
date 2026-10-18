const router = require('express').Router();
const Survey = require('../models/Survey');
const Question = require('../models/Question');
const Response = require('../models/Response');
const requireAuth = require('../middleware/auth');
const { validateAnswer } = require('../services/validationEngine');
const { resolveNextQuestion } = require('../services/jumpEngine');

// 获取问卷首题
router.get('/:slug', requireAuth, async (req, res) => {
  const survey = await Survey.findOne({ slug: req.params.slug });
  if (!survey) return res.status(404).json({ error: '问卷不存在' });
  if (survey.status !== 'published') return res.status(400).json({ error: '问卷未发布或已关闭' });

  const questions = await Question.find({ surveyId: survey._id }).sort({ order: 1 });
  res.json({
    survey: { title: survey.title, description: survey.description },
    firstQuestion: questions[0] || null,
  });
});

// 提交当前题目，返回下一题
router.post('/:slug/next', requireAuth, async (req, res) => {
  const { questionId, value, answers = [] } = req.body;
  const survey = await Survey.findOne({ slug: req.params.slug });
  if (!survey || survey.status !== 'published') return res.status(400).json({ error: '问卷不可用' });

  const questions = await Question.find({ surveyId: survey._id }).sort({ order: 1 });
  const current = questions.find(q => q._id.toString() === questionId);
  if (!current) return res.status(400).json({ error: '题目不存在' });

  // 使用校验引擎拦截不合规数据
  const result = validateAnswer(current, value);
  if (!result.ok) return res.status(400).json({ error: result.message });

  // 计算下一题（使用跳转引擎）
  const next = resolveNextQuestion(questions, current, value);
  const updatedAnswers = [...answers, { questionId: current._id, type: current.type, value }];

  if (!next) return res.json({ done: true, answers: updatedAnswers });

  // 防环检测
  if (updatedAnswers.some(a => a.questionId.toString() === next._id.toString())) {
    return res.status(400).json({ error: '检测到跳转循环' });
  }

  res.json({ nextQuestion: next, answers: updatedAnswers });
});

// 最终提交答卷
router.post('/:slug/submit', requireAuth, async (req, res) => {
  const { answers } = req.body;
  const survey = await Survey.findOne({ slug: req.params.slug });
  if (!survey || survey.status !== 'published') return res.status(400).json({ error: '问卷不可用' });

  const questions = await Question.find({ surveyId: survey._id });
  const qMap = new Map(questions.map(q => [q._id.toString(), q]));

  // 后端二次校验，防止前端绕过
  for (const a of answers || []) {
    const q = qMap.get(a.questionId);
    if (!q) return res.status(400).json({ error: '答案包含无效题目' });
    const r = validateAnswer(q, a.value);
    if (!r.ok) return res.status(400).json({ error: r.message });
  }

  const doc = await Response.create({ surveyId: survey._id, userId: req.userId, answers: answers || [] });
  res.status(201).json({ ok: true, responseId: doc._id });
});

module.exports = router;