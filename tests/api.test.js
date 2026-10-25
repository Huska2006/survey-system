const request = require('supertest');
const mongoose = require('mongoose');

let app;

beforeAll(async () => {
  const uri = 'mongodb://127.0.0.1:27017/survey_test_db';
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
    console.log('\n✅ 数据库连接成功！');
  } catch (err) {
    console.error('\n❌ 数据库连接失败:', err.message);
    process.exit(1);
  }
  app = require('../app');
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

beforeEach(async () => {
  if (mongoose.connection.readyState === 1) {
    const collections = await mongoose.connection.db.collections();
    for (const c of collections) await c.deleteMany({});
  }
});

async function registerAndLogin(username = 'alice') {
  await request(app).post('/auth/register').send({ username, password: '123456' });
  const r = await request(app).post('/auth/login').send({ username, password: '123456' });
  return r.body.token;
}

// ================= 第一阶段回归测试 =================
test('T1: 创建问卷成功', async () => {
  const token = await registerAndLogin();
  const r = await request(app).post('/surveys').set('Authorization', `Bearer ${token}`).send({ title: '调查' });
  expect(r.status).toBe(201);
});

test('T3: 跳转逻辑生效', async () => {
  const token = await registerAndLogin();
  const s = await request(app).post('/surveys').set('Authorization', `Bearer ${token}`).send({ title: 'S' });
  
  const q1 = await request(app).post(`/surveys/${s.body._id}/questions`).set('Authorization', `Bearer ${token}`)
    .send({ type: 'single', title: 'Q1', options: [{ key: 'A', label: 'A' }, { key: 'B', label: 'B' }] });
  await request(app).post(`/surveys/${s.body._id}/questions`).set('Authorization', `Bearer ${token}`).send({ type: 'text', title: 'Q2' });
  const q3 = await request(app).post(`/surveys/${s.body._id}/questions`).set('Authorization', `Bearer ${token}`).send({ type: 'text', title: 'Q3' });

  await mongoose.connection.collection('questions').updateOne(
    { _id: new mongoose.Types.ObjectId(q1.body._id) },
    { $set: { jumpRules: [{ when: { optionKey: 'A' }, targetQuestionId: new mongoose.Types.ObjectId(q3.body._id) }] } }
  );
  await request(app).put(`/surveys/${s.body._id}/publish`).set('Authorization', `Bearer ${token}`);

  const r = await request(app).post(`/fill/${s.body.slug}/next`).set('Authorization', `Bearer ${token}`)
    .send({ questionId: q1.body._id, value: 'A', answers: [] });
  expect(r.body.nextQuestion._id).toBe(q3.body._id);
});

test('T4: 多选校验', async () => {
  const token = await registerAndLogin();
  const s = await request(app).post('/surveys').set('Authorization', `Bearer ${token}`).send({ title: 'S' });
  const q = await request(app).post(`/surveys/${s.body._id}/questions`).set('Authorization', `Bearer ${token}`)
    .send({ type: 'multiple', title: '多选', options: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }], selectLimit: { min: 2 } });
  await request(app).put(`/surveys/${s.body._id}/publish`).set('Authorization', `Bearer ${token}`);

  const r = await request(app).post(`/fill/${s.body.slug}/next`).set('Authorization', `Bearer ${token}`)
    .send({ questionId: q.body._id, value: ['a'], answers: [] });
  expect(r.status).toBe(400);
});

test('T5: 数字校验', async () => {
  const token = await registerAndLogin();
  const s = await request(app).post('/surveys').set('Authorization', `Bearer ${token}`).send({ title: 'S' });
  const q = await request(app).post(`/surveys/${s.body._id}/questions`).set('Authorization', `Bearer ${token}`)
    .send({ type: 'number', title: '年龄', numberLimit: { min: 0, max: 120, integerOnly: true } });
  await request(app).put(`/surveys/${s.body._id}/publish`).set('Authorization', `Bearer ${token}`);

  const r1 = await request(app).post(`/fill/${s.body.slug}/next`).set('Authorization', `Bearer ${token}`)
    .send({ questionId: q.body._id, value: 121, answers: [] });
  expect(r1.status).toBe(400);
});

test('T6+T7: 统计聚合', async () => {
  const token = await registerAndLogin();
  const s = await request(app).post('/surveys').set('Authorization', `Bearer ${token}`).send({ title: 'S' });
  const q1 = await request(app).post(`/surveys/${s.body._id}/questions`).set('Authorization', `Bearer ${token}`)
    .send({ type: 'single', title: '性别', options: [{ key: 'A', label: 'A' }, { key: 'B', label: 'B' }] });
  
  await request(app).put(`/surveys/${s.body._id}/publish`).set('Authorization', `Bearer ${token}`);

  const submit = async (gender) => {
    await request(app).post(`/fill/${s.body.slug}/submit`).set('Authorization', `Bearer ${token}`)
      .send({ answers: [{ questionId: q1.body._id, type: 'single', value: gender }] });
  };
  await submit('A'); await submit('A'); await submit('B');

  const stats = await request(app).get(`/stats/${s.body._id}`).set('Authorization', `Bearer ${token}`);
  expect(stats.body.total).toBe(3);
});

// ================= 第二阶段新增测试 =================

test('T8: 题目保存到题库并共享', async () => {
  const tokenA = await registerAndLogin('teacher');
  const tokenB = await registerAndLogin('student');
  
  // 老师建题
  const lib = await request(app).post('/library').set('Authorization', `Bearer ${tokenA}`)
    .send({ title: '你的年龄', type: 'number' });
  expect(lib.status).toBe(201);
  
  // 共享给学生
  const userB = await mongoose.connection.db.collection('users').findOne({ username: 'student' });
  await request(app).put(`/library/${lib.body.lib._id}/share`).set('Authorization', `Bearer ${tokenA}`)
    .send({ userId: userB._id });
    
  // 学生获取可用列表
  const studentLibs = await request(app).get('/library').set('Authorization', `Bearer ${tokenB}`);
  expect(studentLibs.body.length).toBe(1);
});

test('T9: 版本控制与历史树', async () => {
  const token = await registerAndLogin();
  
  const lib = await request(app).post('/library').set('Authorization', `Bearer ${token}`)
    .send({ title: '你的职业', type: 'text' });
    
  const v2 = await request(app).post(`/library/${lib.body.lib._id}/versions`).set('Authorization', `Bearer ${token}`)
    .send({ title: '你的具体职业', type: 'text' });
  expect(v2.body.versionNumber).toBe(2);
  expect(v2.body.parentVersionId).toBe(lib.body.version._id.toString());

  const history = await request(app).get(`/library/${lib.body.lib._id}/history`).set('Authorization', `Bearer ${token}`);
  expect(history.body.length).toBe(2); 
});

test('T10: 已发布问卷阻止修改题目', async () => {
  const token = await registerAndLogin();
  const s = await request(app).post('/surveys').set('Authorization', `Bearer ${token}`).send({ title: 'S' });
  await request(app).post(`/surveys/${s.body._id}/questions`).set('Authorization', `Bearer ${token}`).send({ type: 'text', title: 'Q1' });
  await request(app).put(`/surveys/${s.body._id}/publish`).set('Authorization', `Bearer ${token}`);

  // 尝试给已发布问卷加题
  const r = await request(app).post(`/surveys/${s.body._id}/questions`).set('Authorization', `Bearer ${token}`)
    .send({ type: 'text', title: '新题' });
  expect(r.status).toBe(400);
  expect(r.body.error).toContain('已发布');
});

test('T11: 跨问卷查看模板统计', async () => {
  const token = await registerAndLogin();
  
  // 建模板
  const lib = await request(app).post('/library').set('Authorization', `Bearer ${token}`)
    .send({ title: '水果', type: 'single', options: [{key: 'A', label: '苹果'}] });
  const libId = lib.body.lib._id;
  const versionId = lib.body.version._id;

  // 建问卷A
  const sA = await request(app).post('/surveys').set('Authorization', `Bearer ${token}`).send({ title: '问卷A' });
  const qA = await request(app).post(`/surveys/${sA.body._id}/questions`).set('Authorization', `Bearer ${token}`)
    .send({ templateId: libId, versionId: versionId, title: '水果', order: 1 });
  
  // 建问卷B
  const sB = await request(app).post('/surveys').set('Authorization', `Bearer ${token}`).send({ title: '问卷B' });
  const qB = await request(app).post(`/surveys/${sB.body._id}/questions`).set('Authorization', `Bearer ${token}`)
    .send({ templateId: libId, versionId: versionId, title: '水果', order: 1 });

  await request(app).put(`/surveys/${sA.body._id}/publish`).set('Authorization', `Bearer ${token}`);
  await request(app).put(`/surveys/${sB.body._id}/publish`).set('Authorization', `Bearer ${token}`);
  
  // 提交回答（注意带上 templateId）
  await request(app).post(`/fill/${sA.body.slug}/submit`).set('Authorization', `Bearer ${token}`)
    .send({ answers: [{ questionId: qA.body._id, templateId: libId, type: 'single', value: 'A' }] });
  await request(app).post(`/fill/${sB.body.slug}/submit`).set('Authorization', `Bearer ${token}`)
    .send({ answers: [{ questionId: qB.body._id, templateId: libId, type: 'single', value: 'A' }] });

  // 统计跨问卷数据
  const stats = await request(app).get(`/stats/template/${libId}`).set('Authorization', `Bearer ${token}`);
  expect(stats.body.totalAnswers).toBe(2);
});