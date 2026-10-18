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

// ================= 基础业务测试 =================
test('T1: 创建问卷成功', async () => {
  const token = await registerAndLogin();
  const r = await request(app).post('/surveys').set('Authorization', `Bearer ${token}`)
    .send({ title: '调查', allowAnonymous: true });
  expect(r.status).toBe(201);
});

// ================= 核心引擎测试 =================
test('T3: 跳转逻辑生效（选A跳Q3）', async () => {
  const token = await registerAndLogin();
  const s = await request(app).post('/surveys').set('Authorization', `Bearer ${token}`).send({ title: 'S' });
  
  // 建3道题
  const q1 = await request(app).post(`/surveys/${s.body._id}/questions`).set('Authorization', `Bearer ${token}`)
    .send({ type: 'single', title: 'Q1', options: [{ key: 'A', label: 'A' }, { key: 'B', label: 'B' }] });
  await request(app).post(`/surveys/${s.body._id}/questions`).set('Authorization', `Bearer ${token}`).send({ type: 'text', title: 'Q2' });
  const q3 = await request(app).post(`/surveys/${s.body._id}/questions`).set('Authorization', `Bearer ${token}`).send({ type: 'text', title: 'Q3' });

  // 直接修改数据库，给 Q1 加上跳转规则：选 A 跳到 Q3
  await mongoose.connection.collection('questions').updateOne(
    { _id: new mongoose.Types.ObjectId(q1.body._id) },
    { $set: { jumpRules: [{ when: { optionKey: 'A' }, targetQuestionId: new mongoose.Types.ObjectId(q3.body._id) }] } }
  );

  await request(app).put(`/surveys/${s.body._id}/publish`).set('Authorization', `Bearer ${token}`);

  // 模拟选 A 提交
  const r = await request(app).post(`/fill/${s.body.slug}/next`).set('Authorization', `Bearer ${token}`)
    .send({ questionId: q1.body._id, value: 'A', answers: [] });

  expect(r.status).toBe(200);
  // 断言下一题直接变成了 Q3
  expect(r.body.nextQuestion._id).toBe(q3.body._id);
});

test('T4: 多选数量校验（不满2项报错）', async () => {
  const token = await registerAndLogin();
  const s = await request(app).post('/surveys').set('Authorization', `Bearer ${token}`).send({ title: 'S' });
  
  const q = await request(app).post(`/surveys/${s.body._id}/questions`).set('Authorization', `Bearer ${token}`)
    .send({ type: 'multiple', title: '多选', options: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }], selectLimit: { min: 2 } });
  await request(app).put(`/surveys/${s.body._id}/publish`).set('Authorization', `Bearer ${token}`);

  // 只选1个提交
  const r = await request(app).post(`/fill/${s.body.slug}/next`).set('Authorization', `Bearer ${token}`)
    .send({ questionId: q.body._id, value: ['a'], answers: [] });

  expect(r.status).toBe(400);
  expect(r.body.error).toContain('至少选择 2 项');
});

test('T5: 数字校验（越界或小数报错）', async () => {
  const token = await registerAndLogin();
  const s = await request(app).post('/surveys').set('Authorization', `Bearer ${token}`).send({ title: 'S' });
  
  const q = await request(app).post(`/surveys/${s.body._id}/questions`).set('Authorization', `Bearer ${token}`)
    .send({ type: 'number', title: '年龄', numberLimit: { min: 0, max: 120, integerOnly: true } });
  await request(app).put(`/surveys/${s.body._id}/publish`).set('Authorization', `Bearer ${token}`);

  // 1. 越界
  const r1 = await request(app).post(`/fill/${s.body.slug}/next`).set('Authorization', `Bearer ${token}`)
    .send({ questionId: q.body._id, value: 121, answers: [] });
  expect(r1.status).toBe(400);

  // 2. 小数
  const r2 = await request(app).post(`/fill/${s.body.slug}/next`).set('Authorization', `Bearer ${token}`)
    .send({ questionId: q.body._id, value: 12.5, answers: [] });
  expect(r2.status).toBe(400);
});

// ================= 提交与统计测试 =================
test('T6+T7: 提交答卷并统计单选和多选', async () => {
  const token = await registerAndLogin();
  const s = await request(app).post('/surveys').set('Authorization', `Bearer ${token}`).send({ title: 'S' });
  
  const q1 = await request(app).post(`/surveys/${s.body._id}/questions`).set('Authorization', `Bearer ${token}`)
    .send({ type: 'single', title: '性别', options: [{ key: 'A', label: 'A' }, { key: 'B', label: 'B' }] });
  const q2 = await request(app).post(`/surveys/${s.body._id}/questions`).set('Authorization', `Bearer ${token}`)
    .send({ type: 'multiple', title: '水果', options: [{ key: 'A', label: 'A' }, { key: 'B', label: 'B' }, { key: 'C', label: 'C' }] });
  
  await request(app).put(`/surveys/${s.body._id}/publish`).set('Authorization', `Bearer ${token}`);

  // 提交三份答卷
  const submit = async (gender, fruits) => {
    const r = await request(app).post(`/fill/${s.body.slug}/submit`).set('Authorization', `Bearer ${token}`)
      .send({ answers: [
        { questionId: q1.body._id, type: 'single', value: gender },
        { questionId: q2.body._id, type: 'multiple', value: fruits },
      ]});
    expect(r.status).toBe(201);
  };

  await submit('A', ['A', 'B']);
  await submit('A', ['A']);
  await submit('B', ['B', 'C']);

  // 获取统计结果
  const stats = await request(app).get(`/stats/${s.body._id}`).set('Authorization', `Bearer ${token}`);
  
  expect(stats.status).toBe(200);
  expect(stats.body.total).toBe(3); // 总人数

  // 验证单选：A 选了 2 次，B 选了 1 次
  const single = stats.body.questions.find(q => q.type === 'single');
  const aCount = single.options.find(o => o._id === 'A').count;
  expect(aCount).toBe(2);

  // 验证多选二次拆解：A选了2次，B选了2次，C选了1次
  const multi = stats.body.questions.find(q => q.type === 'multiple');
  const map = Object.fromEntries(multi.options.map(o => [o._id, o.count]));
  expect(map.A).toBe(2);
  expect(map.B).toBe(2);
  expect(map.C).toBe(1);
});