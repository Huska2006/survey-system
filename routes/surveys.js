const router = require('express').Router();
const crypto = require('crypto');
const Survey = require('../models/Survey');
const Question = require('../models/Question');
const requireAuth = require('../middleware/auth');
const { hasCycle } = require('../services/jumpEngine');

// 所有的问卷管理接口都需要登录
router.use(requireAuth);

// 1. 创建问卷
router.post('/', async (req, res) => {
  try {
    const { title, description, allowAnonymous } = req.body;
    
    // 生成一个随机短链接标识，例如 "a1b2c3d4"
    const slug = crypto.randomBytes(4).toString('hex');
    
    const survey = await Survey.create({
      ownerId: req.userId,
      title,
      description: description || '',
      allowAnonymous: !!allowAnonymous,
      slug,
    });
    res.status(201).json(survey);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. 获取当前用户的问卷列表
router.get('/', async (req, res) => {
  // 只查当前登录用户创建的问卷
  const list = await Survey.find({ ownerId: req.userId }).sort({ createdAt: -1 });
  res.json(list);
});

// 3. 获取单份问卷详情（包含所有题目）
router.get('/:id', async (req, res) => {
  const survey = await Survey.findById(req.params.id);
  if (!survey) return res.status(404).json({ error: '问卷不存在' });
  
  // 越权检查
  if (survey.ownerId.toString() !== req.userId.toString()) {
    return res.status(403).json({ error: '无权访问该问卷' });
  }
  
  const questions = await Question.find({ surveyId: survey._id }).sort({ order: 1 });
  res.json({ survey, questions });
});

// 4. 给问卷添加题目
router.post('/:id/questions', async (req, res) => {
  try {
    const survey = await Survey.findById(req.params.id);
    if (!survey) return res.status(404).json({ error: '问卷不存在' });
    if (survey.ownerId.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: '无权访问' });
    }

    // 自动计算新题目的顺序（排在最后面）
    const count = await Question.countDocuments({ surveyId: survey._id });
    
    const q = await Question.create({
      ...req.body,
      surveyId: survey._id,
      order: req.body.order != null ? req.body.order : count + 1,
    });
    res.status(201).json(q);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 5. 发布问卷（重点：检查跳转循环）
router.put('/:id/publish', async (req, res) => {
  const survey = await Survey.findById(req.params.id);
  if (!survey) return res.status(404).json({ error: '问卷不存在' });
  if (survey.ownerId.toString() !== req.userId.toString()) {
    return res.status(403).json({ error: '无权访问' });
  }

  const questions = await Question.find({ surveyId: survey._id }).sort({ order: 1 });
  if (questions.length === 0) {
    return res.status(400).json({ error: '问卷必须至少包含一道题目才能发布' });
  }
  
  // 调用跳转引擎，检查是否存在死循环跳转
  if (hasCycle(questions)) {
    return res.status(400).json({ error: '跳转规则存在循环，无法发布，请检查配置' });
  }

  survey.status = 'published';
  await survey.save();
  res.json({ ok: true, slug: survey.slug, message: '发布成功' });
});

// 6. 关闭问卷
router.put('/:id/close', async (req, res) => {
  const survey = await Survey.findById(req.params.id);
  if (!survey) return res.status(404).json({ error: '问卷不存在' });
  if (survey.ownerId.toString() !== req.userId.toString()) {
    return res.status(403).json({ error: '无权访问' });
  }
  survey.status = 'closed';
  await survey.save();
  res.json({ ok: true, message: '问卷已关闭' });
});

module.exports = router;