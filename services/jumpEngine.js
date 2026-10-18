// 匹配单条跳转规则
function matchJumpRule(when, question, answer) {
  if (!when) return false;

  // 按选项跳转（单选 / 多选）
  if (when.optionKey != null) {
    if (question.type === 'single') {
      return answer === when.optionKey;
    }
    if (question.type === 'multiple') {
      return Array.isArray(answer) && answer.includes(when.optionKey);
    }
    return false;
  }

  // 按数字条件跳转
  if (when.operator != null && when.value != null) {
    const n = Number(answer);
    if (Number.isNaN(n)) return false;
    switch (when.operator) {
      case '>':  return n > when.value;
      case '>=': return n >= when.value;
      case '<':  return n < when.value;
      case '<=': return n <= when.value;
      case '==': return n === when.value;
      default:   return false;
    }
  }

  return false;
}

// 计算下一题（sortedQuestions 必须是按 order 排好序的数组）
function resolveNextQuestion(sortedQuestions, current, answer) {
  // 1. 先看当前题目有没有配置跳转规则
  for (const rule of current.jumpRules || []) {
    if (matchJumpRule(rule.when, current, answer)) {
      const target = sortedQuestions.find(
        q => q._id.toString() === rule.targetQuestionId?.toString()
      );
      if (target) return target;
    }
  }

  // 2. 如果没有规则命中，默认去下一题
  const idx = sortedQuestions.findIndex(
    q => q._id.toString() === current._id.toString()
  );
  if (idx >= 0 && idx < sortedQuestions.length - 1) {
    return sortedQuestions[idx + 1];
  }
  return null; // 没有下一题了，说明问卷填完了
}

// 发布前的环检测（使用 Kahn 拓扑排序算法）
// 防止用户设置 "Q1跳Q2，Q2跳Q1" 导致死循环
function hasCycle(questions) {
  const idSet = new Set(questions.map(q => q._id.toString()));
  const indeg = new Map(questions.map(q => [q._id.toString(), 0]));
  const adj = new Map(questions.map(q => [q._id.toString(), []]));

  // 构建有向图
  for (const q of questions) {
    for (const rule of q.jumpRules || []) {
      const from = q._id.toString();
      const to = rule.targetQuestionId?.toString();
      if (to && idSet.has(to)) {
        adj.get(from).push(to);
        indeg.set(to, (indeg.get(to) || 0) + 1);
      }
    }
  }

  // 拓扑排序
  const queue = [];
  for (const [id, d] of indeg.entries()) {
    if (d === 0) queue.push(id);
  }

  let visited = 0;
  while (queue.length) {
    const id = queue.shift();
    visited += 1;
    for (const next of adj.get(id) || []) {
      indeg.set(next, indeg.get(next) - 1);
      if (indeg.get(next) === 0) queue.push(next);
    }
  }

  return visited !== questions.length; // 如果访问过的节点数不等于总数，说明有环
}

module.exports = { matchJumpRule, resolveNextQuestion, hasCycle };