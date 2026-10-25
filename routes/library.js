const router = require('express').Router();
const QuestionLibrary = require('../models/QuestionLibrary');
const QuestionVersion = require('../models/QuestionVersion');
const Question = require('../models/Question');
const Survey = require('../models/Survey');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

// 1. 创建题目并存入题库 (v1)
router.post('/', async (req, res) => {
  try {
    const lib = await QuestionLibrary.create({ ownerId: req.userId, title: req.body.title });
    const version = await QuestionVersion.create({
      templateId: lib._id,
      versionNumber: 1,
      ...req.body
    });
    lib.currentVersionId = version._id;
    await lib.save();
    res.status(201).json({ lib, version });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 2. 基于老版本创建新版本 (派生 v2, v3...)
router.post('/:id/versions', async (req, res) => {
  try {
    const lib = await QuestionLibrary.findById(req.params.id);
    if (!lib) return res.status(404).json({ error: '题库不存在' });
    
    const latestVersion = await QuestionVersion.findById(lib.currentVersionId);
    const newVersion = await QuestionVersion.create({
      templateId: lib._id,
      versionNumber: latestVersion.versionNumber + 1,
      parentVersionId: latestVersion._id,
      ...req.body
    });
    
    lib.currentVersionId = newVersion._id;
    await lib.save();
    res.status(201).json(newVersion);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 3. 查看某个题目的历史版本树
router.get('/:id/history', async (req, res) => {
  const versions = await QuestionVersion.find({ templateId: req.params.id }).sort({ versionNumber: 1 });
  res.json(versions);
});

// 4. 共享给同事
router.put('/:id/share', async (req, res) => {
  const lib = await QuestionLibrary.findById(req.params.id);
  if (!lib) return res.status(404).json({ error: '不存在' });
  if (lib.ownerId.toString() !== req.userId.toString()) return res.status(403).json({ error: '无权操作' });
  
  if (!lib.sharedWith.includes(req.body.userId)) {
    lib.sharedWith.push(req.body.userId);
    await lib.save();
  }
  res.json({ ok: true, message: '共享成功' });
});

// 5. 获取自己可用的题库列表（自己建的 + 别人共享的）
router.get('/', async (req, res) => {
  const list = await QuestionLibrary.find({
    $or: [
      { ownerId: req.userId },
      { sharedWith: req.userId }
    ]
  }).populate('currentVersionId');
  res.json(list);
});

// 6. 查看该题被哪些问卷使用
router.get('/:id/usage', async (req, res) => {
  const templateId = req.params.id;
  // 找出所有引用了该模板的题目，提取出问卷ID
  const questions = await Question.find({ templateId }).distinct('surveyId');
  const surveys = await Survey.find({ _id: { $in: questions } });
  res.json(surveys);
});

module.exports = router;