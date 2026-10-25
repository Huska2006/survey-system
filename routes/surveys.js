const router = require('express').Router();
const crypto = require('crypto');
const Survey = require('../models/Survey');
const Question = require('../models/Question');
const QuestionVersion = require('../models/QuestionVersion'); // 新增
const requireAuth = require('../middleware/auth');
const { hasCycle } = require('../services/jumpEngine');

router.use(requireAuth);

router.post('/', async (req, res) => {
  try {
    const { title, description, allowAnonymous } = req.body;
    const slug = crypto.randomBytes(4).toString('hex');
    const survey = await Survey.create({ ownerId: req.userId, title, description: description || '', allowAnonymous: !!allowAnonymous, slug });
    res.status(201).json(survey);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  const list = await Survey.find({ ownerId: req.userId }).sort({ createdAt: -1 });
  res.json(list);
});

router.get('/:id', async (req, res) => {
  const survey = await Survey.findById(req.params.id);
  if (!survey) return res.status(404).json({ error: '问卷不存在' });
  if (survey.ownerId.toString() !== req.userId.toString()) return res.status(403).json({ error: '无权访问' });
  const questions = await Question.find({ surveyId: survey._id }).sort({ order: 1 });
  res.json({ survey, questions });
});

// 修改点：添加题目逻辑（拦截已发布 + 支持题库快照）
router.post('/:id/questions', async (req, res) => {
  try {
    const survey = await Survey.findById(req.params.id);
    if (!survey) return res.status(404).json({ error: '问卷不存在' });
    if (survey.ownerId.toString() !== req.userId.toString()) return res.status(403).json({ error: '无权访问' });

    // 第二阶段新增：需求三（已发布问卷里的题目不能被修改）
    if (survey.status === 'published') {
      return res.status(400).json({ error: '问卷已发布，为保证数据一致，不能直接修改题目' });
    }

    let questionData = { ...req.body, surveyId: survey._id };

    // 第二阶段新增：如果是从题库选择的题目
    if (req.body.templateId && req.body.versionId) {
      const version = await QuestionVersion.findById(req.body.versionId);
      if (!version) return res.status(404).json({ error: '题库版本不存在' });
      
      // 将版本内容“快照”复制到问卷题目中，实现解耦
      questionData = {
        surveyId: survey._id,
        templateId: req.body.templateId,
        versionId: req.body.versionId,
        order: req.body.order,
        title: req.body.title,
        type: version.type,
        options: version.options,
        selectLimit: version.selectLimit,
        textLimit: version.textLimit,
        numberLimit: version.numberLimit,
        required: req.body.required || false
      };
    }

    const count = await Question.countDocuments({ surveyId: survey._id });
    questionData.order = questionData.order || count + 1;
    
    const q = await Question.create(questionData);
    res.status(201).json(q);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/publish', async (req, res) => {
  const survey = await Survey.findById(req.params.id);
  if (!survey) return res.status(404).json({ error: '问卷不存在' });
  if (survey.ownerId.toString() !== req.userId.toString()) return res.status(403).json({ error: '无权访问' });

  const questions = await Question.find({ surveyId: survey._id }).sort({ order: 1 });
  if (questions.length === 0) return res.status(400).json({ error: '问卷必须包含题目' });
  if (hasCycle(questions)) return res.status(400).json({ error: '跳转存在循环' });

  survey.status = 'published';
  await survey.save();
  res.json({ ok: true, slug: survey.slug, message: '发布成功' });
});

router.put('/:id/close', async (req, res) => {
  const survey = await Survey.findById(req.params.id);
  if (!survey) return res.status(404).json({ error: '问卷不存在' });
  if (survey.ownerId.toString() !== req.userId.toString()) return res.status(403).json({ error: '无权访问' });
  survey.status = 'closed';
  await survey.save();
  res.json({ ok: true, message: '关闭成功' });
});

module.exports = router;