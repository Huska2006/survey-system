function isEmpty(v) {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

function validateAnswer(question, rawValue) {
  const { type, required } = question;

  // 1. 检查是否必答
  if (required && isEmpty(rawValue)) {
    return { ok: false, message: `第 ${question.order} 题为必答题` };
  }

  // 如果没填且不是必答，直接通过
  if (isEmpty(rawValue)) {
    return { ok: true };
  }

  // 2. 单选题校验
  if (type === 'single') {
    const valid = (question.options || []).some(o => o.key === rawValue);
    if (!valid) return { ok: false, message: '选项无效' };
  }

  // 3. 多选题校验
  if (type === 'multiple') {
    const values = Array.isArray(rawValue) ? rawValue : [];
    const { min, max } = question.selectLimit || {};
    
    if (min != null && values.length < min) {
      return { ok: false, message: `至少选择 ${min} 项` };
    }
    if (max != null && values.length > max) {
      return { ok: false, message: `最多选择 ${max} 项` };
    }
    
    const validKeys = (question.options || []).map(o => o.key);
    if (values.some(v => !validKeys.includes(v))) {
      return { ok: false, message: '包含无效选项' };
    }
  }

  // 4. 文本填空校验
  if (type === 'text') {
    const s = String(rawValue);
    const { minLength, maxLength } = question.textLimit || {};
    
    if (minLength != null && s.length < minLength) {
      return { ok: false, message: `至少输入 ${minLength} 个字符` };
    }
    if (maxLength != null && s.length > maxLength) {
      return { ok: false, message: `最多输入 ${maxLength} 个字符` };
    }
  }

  // 5. 数字填空校验
  if (type === 'number') {
    const n = Number(rawValue);
    if (Number.isNaN(n)) {
      return { ok: false, message: '必须为数字' };
    }
    
    const { min, max, integerOnly } = question.numberLimit || {};
    
    if (integerOnly && !Number.isInteger(n)) {
      return { ok: false, message: '必须为整数' };
    }
    if (min != null && n < min) {
      return { ok: false, message: `不能小于 ${min}` };
    }
    if (max != null && n > max) {
      return { ok: false, message: `不能大于 ${max}` };
    }
  }

  return { ok: true };
}

module.exports = { validateAnswer, isEmpty };