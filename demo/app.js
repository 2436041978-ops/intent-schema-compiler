// Schema-As-Code Demo - Four Layers Validation Engine
// 统一配色风格：深色主题 + Inter 字体

const PROHIBITED_SYNONYMS = {
  '严重': { standard: 'Critical', reason: '情绪权重降级' },
  '危急': { standard: 'Critical', reason: '与 P1 告警级别混淆' },
  '紧急': { standard: 'Critical', reason: '非标准运维术语' }
};

const VALID_LEVELS = ['Critical', 'Warning', 'Info'];

function runValidation() {
  const alertLevel = document.getElementById('alertLevel').value;
  const rootCause = document.getElementById('rootCause').value;
  const confidence = parseFloat(document.getElementById('confidence').value);

  const llmOutput = {
    alert_level: alertLevel,
    root_cause: rootCause,
    confidence_score: confidence
  };

  // 运行四层推演
  const result = validateFourLayers(llmOutput);

  // 更新界面
  updateLlmOutput(llmOutput, result);
  updateValidation(result);
  updateUiRender(alertLevel, rootCause, confidence, result.overall);
}

function validateFourLayers(output) {
  const layers = [];
  let overall = 'PASS';

  // 1. 语法推演
  const syntaxValid = (
    typeof output.alert_level === 'string' &&
    typeof output.root_cause === 'string' &&
    typeof output.confidence_score === 'number' &&
    output.confidence_score >= 0 && output.confidence_score <= 1
  );
  layers.push({
    name: '语法推演',
    status: syntaxValid ? 'PASS' : 'BLOCK',
    detail: syntaxValid ? 'JSON 结构完整，字段类型正确' : '字段类型错误或缺失'
  });
  if (!syntaxValid) overall = 'BLOCK';

  // 2. 语义推演
  let semanticStatus = 'PASS';
  let semanticDetail = `alert_level 匹配标准令牌 ${output.alert_level}`;
  let driftType = null;

  if (PROHIBITED_SYNONYMS[output.alert_level]) {
    const mapping = PROHIBITED_SYNONYMS[output.alert_level];
    semanticStatus = 'BLOCK';
    semanticDetail = `检测到同义词替换: "${output.alert_level}" → 应为 "${mapping.standard}" (${mapping.reason})`;
    driftType = 'synonym_substitution';
    overall = 'BLOCK';
  } else if (!VALID_LEVELS.includes(output.alert_level)) {
    semanticStatus = 'BLOCK';
    semanticDetail = `alert_level "${output.alert_level}" 不在标准令牌列表中`;
    overall = 'BLOCK';
  }

  layers.push({
    name: '语义推演',
    status: semanticStatus,
    detail: semanticDetail,
    driftType: driftType
  });

  // 3. 安全推演
  const safetyValid = output.root_cause && output.root_cause.length > 0;
  layers.push({
    name: '安全推演',
    status: safetyValid ? 'PASS' : 'BLOCK',
    detail: safetyValid ? '无禁止模式，包含根因描述' : '缺少根因描述，无法定位故障'
  });
  if (!safetyValid) overall = 'BLOCK';

  // 4. 美感推演
  const aestheticsValid = output.root_cause.length <= 200 && output.confidence_score >= 0.5;
  let aestheticsDetail = '信息密度正常，文案长度合理';
  let aestheticsStatus = 'PASS';

  if (output.root_cause.length > 200) {
    aestheticsStatus = 'WARN';
    aestheticsDetail = '文案长度偏长，建议精简';
  } else if (output.confidence_score < 0.5) {
    aestheticsStatus = 'WARN';
    aestheticsDetail = '置信度偏低，建议人工复核';
  }

  layers.push({
    name: '美感推演',
    status: aestheticsStatus,
    detail: aestheticsDetail
  });

  return { overall, layers };
}

function updateLlmOutput(output, result) {
  const el = document.getElementById('llmOutput');
  const statusEl = document.getElementById('llmStatus');

  const jsonStr = JSON.stringify(output, null, 2);
  el.textContent = jsonStr;

  if (result.overall === 'PASS') {
    statusEl.innerHTML = '✅ 合规输出';
    statusEl.style.color = '#10b981';
  } else {
    statusEl.innerHTML = '❌ 推演拦截';
    statusEl.style.color = '#ef4444';
  }
}

function updateValidation(result) {
  const el = document.getElementById('validationResult');

  const resultClass = result.overall === 'PASS' ? 'pass' : 'block';
  const resultIcon = result.overall === 'PASS' ? '✅' : '❌';
  const resultText = result.overall === 'PASS' ? 'PASS' : 'BLOCK';

  let html = `
    <div class="val-result ${resultClass}">
      <div style="font-weight:600; margin-bottom:6px;">${resultIcon} ${resultText}</div>
      <div style="font-size:11px; opacity:0.9;">
        ${result.overall === 'PASS' ? '所有推演层通过' : '检测到语义漂移，已拦截'}
      </div>
    </div>
  `;

  result.layers.forEach(layer => {
    const lClass = layer.status === 'PASS' ? 'pass' : layer.status === 'BLOCK' ? 'block' : 'warn';
    const lIcon = layer.status === 'PASS' ? '✓' : layer.status === 'BLOCK' ? '✗' : '!';
    html += `
      <div class="val-layer">
        <span class="val-layer-name">${layer.name}</span>
        <span class="val-layer-status ${lClass}">${lIcon} ${layer.status}</span>
      </div>
      <div class="val-layer-detail">${layer.detail}</div>
    `;
  });

  el.innerHTML = html;
}

function updateUiRender(level, cause, confidence, overall) {
  const el = document.getElementById('uiRender');

  let alertClass = 'alert-critical';
  let icon = '🚨';
  let title = 'Critical · 系统告警';
  let color = '#fca5a5';

  if (level === 'Warning') {
    alertClass = 'alert-warning';
    icon = '⚠️';
    title = 'Warning · 系统警告';
    color = '#fcd34d';
  } else if (level === 'Info') {
    alertClass = 'alert-info';
    icon = 'ℹ️';
    title = 'Info · 系统通知';
    color = '#93c5fd';
  } else if (PROHIBITED_SYNONYMS[level]) {
    alertClass = 'alert-critical';
    icon = '🚫';
    title = `${level} · 同义词替换违规`;
    color = '#fca5a5';
  }

  const pulseClass = overall === 'PASS' && level === 'Critical' ? 'pulse-red' : '';

  el.innerHTML = `
    <div class="alert-card ${alertClass} ${pulseClass}">
      <span class="alert-icon">${icon}</span>
      <div class="alert-content">
        <div class="alert-title">${title}</div>
        <div class="alert-desc">${cause}</div>
        <div style="margin-top: 8px; font-size: 11px; color: ${color};">置信度: ${Math.round(confidence * 100)}%</div>
        ${overall === 'BLOCK' ? '<div style="margin-top: 6px; font-size: 11px; color: #ef4444; font-weight: 600;">❌ 界面渲染已阻断</div>' : ''}
      </div>
    </div>
  `;
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  runValidation();
});
