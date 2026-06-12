// Schema-As-Code Showcase App
// 场景数据与交互逻辑

const scenes = {
  cover: {
    title: 'Schema-As-Code 商业全景',
    desc: '当 AI 生成界面时，谁在守住设计意图？',
    type: 'cover'
  },
  ops: {
    title: '场景 1：DesignOps — 规范同步',
    desc: '规范更新一次，DesignOps 同学要开几场会？以前靠人肉广播，现在靠 Git Diff。',
    type: 'five-col'
  },
  system: {
    title: '场景 2：Design System — Token 语义',
    desc: 'Design Token 管住了颜色，但管不了 AI 把 "Critical" 写成 "严重"。',
    type: 'five-col'
  },
  frontend: {
    title: '场景 3：前端工程 — 高危操作',
    desc: 'AI 生成一个页面，前端同学花 30% 时间在修什么？修语义错误。',
    type: 'five-col'
  },
  infra: {
    title: '场景 4：基础设施 — 错误分级',
    desc: 'ChatGPT 的四种错误状态，为什么共用同一种红色？',
    type: 'five-col'
  },
  cross: {
    title: '场景 5：跨工具消费 — Intent Schema Interface',
    desc: '同一个 YAML 语义契约，自动编译为 Claude Code / v0 / DevUI HMC 的专属约束格式。',
    type: 'cross-tool'
  }
};

// YAML 数据
const yamlData = {
  ops: `intent_id: "ALERT-001"
version: "1.1"
semantic_domain: "observational"

# v1.0 旧规则
synonym_firewall:
  prohibited:
    - term: "严重"
      standard_token: "Critical"
      context: "system_alert"
      reason: "情绪权重降级"

# v1.1 新增规则（Git Diff 高亮）
  + prohibited:
  +   - term: "危急"
  +     standard_token: "Critical"
  +     context: "system_alert"
  +     reason: "与 P1 告警级别混淆"
  +   - term: "紧急"
  +     standard_token: "Critical"
  +     context: "system_alert"
  +     reason: "非标准运维术语"

# 自动下发到下游 Prompt 模板
  downstream_sync:
    tools: ["claude_code", "v0", "devui_hmc"]
    trigger: "git_diff"
    auto_compile: true`,

  system: `semantic_tokens:
  status.critical:
    color_value: "#FF4D4F"
    # 语义层：场景约束
    semantic_domain: "observational"
    allowed_scenes:
      - "system_alert"
      - "error_state"
    prohibited_scenes:
      - "toast"
      - "tooltip"
      - "success_message"
    llm_constraints:
      - "禁止在提示场景使用 status.critical"
      - "禁止将 Critical 降级为严重/紧急/危急"

  status.success:
    color_value: "#52C41A"
    semantic_domain: "feedback"
    allowed_scenes:
      - "toast"
      - "success_message"
    llm_constraints:
      - "禁止在告警场景使用 status.success"`,

  frontend: `human_ai_boundary:
  ai_prohibited:
    - "直接执行删除操作而不显示二次确认"
    - "将高危操作按钮设计为普通主按钮样式"
    - "在文案中省略操作后果说明"

  required:
    - action_type: "destructive"
      must_include:
        - "二次确认弹窗"
        - "操作后果明确说明（如：此操作不可恢复）"
        - "取消选项（保留且视觉权重不低于确认）"
      visual_mapping:
        color_token: "status.critical"
        button_style: "outline_danger"
        confirmation_step: "type_account_name"
      llm_constraints:
        - "禁止生成 contained 主按钮"
        - "禁止将删除按钮设计为蓝色/绿色"`,

  infra: `semantic_tokens:
  error_severity:
    fatal:
      description: "系统级故障，对话上下文可能丢失"
      visual_mapping:
        color_token: "status.critical"
        motion_token: "pulse.red.urgent"
        icon_token: "alert.octagon"
      user_action: ["refresh_page", "export_history"]

    transient:
      description: "网络抖动，系统可自动恢复"
      visual_mapping:
        color_token: "status.neutral"
        motion_token: "spinner"
        icon_token: "loader"
      user_action: ["wait_auto_retry"]

    retryable:
      description: "用户可自助恢复的频率限制"
      visual_mapping:
        color_token: "status.warning"
        motion_token: "none"
        icon_token: "clock"
      user_action: ["upgrade_plan", "set_reminder"]

    degraded:
      description: "部分功能可用，可继续生成"
      visual_mapping:
        color_token: "status.info"
        motion_token: "none"
        icon_token: "continue"
      user_action: ["continue_generation"]`,

  cross: `intent_id: "DEL-001"
semantic_domain: "transactional"

semantic_tokens:
  destructive_action:
    description: "不可逆的数据销毁操作"
    visual_mapping:
      color_token: "status.critical"
      button_style: "outline_danger"
    llm_constraints:
      - "禁止将删除按钮设计为普通主按钮样式"
      - "必须包含二次确认弹窗"
      - "文案必须明确说明'此操作不可恢复'"

# ISI 接口：编译为任意 D3C 工具格式
isi_compile:
  target_tools:
    - "claude_code"
    - "v0"
    - "devui_hmc"
    - "figma_mcp"
  output_format: "per_tool"
  auto_inject: true`
};

// JSON Schema 编译产物
const jsonSchemaData = {
  ops: JSON.stringify({
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "AlertLevelConstraint",
    "type": "object",
    "properties": {
      "alert_level": {
        "type": "string",
        "enum": ["Critical", "Warning", "Info"],
        "not": { "enum": ["严重", "危急", "紧急"] }
      },
      "context": { "const": "system_alert" }
    },
    "required": ["alert_level", "context"]
  }, null, 2),

  system: JSON.stringify({
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "SemanticTokenConstraint",
    "type": "object",
    "properties": {
      "scene": {
        "type": "string",
        "enum": ["system_alert", "error_state", "toast", "success_message"]
      },
      "color_token": { "type": "string" }
    },
    "if": {
      "properties": { "scene": { "enum": ["toast", "success_message"] } },
      "required": ["scene"]
    },
    "then": {
      "properties": {
        "color_token": { "not": { "const": "status.critical" } }
      }
    }
  }, null, 2),

  frontend: JSON.stringify({
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "DestructiveActionConstraint",
    "type": "object",
    "properties": {
      "action_type": { "const": "destructive" },
      "button_style": { "const": "outline_danger" },
      "confirmation_step": { "type": "boolean", "const": true },
      "consequence_text": { "type": "string", "minLength": 1 }
    },
    "required": ["action_type", "button_style", "confirmation_step", "consequence_text"]
  }, null, 2),

  infra: JSON.stringify({
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "ErrorSeverityMapping",
    "type": "object",
    "properties": {
      "error_text": { "type": "string" },
      "severity": {
        "type": "string",
        "enum": ["fatal", "transient", "retryable", "degraded"]
      }
    },
    "required": ["error_text", "severity"]
  }, null, 2),

  cross: JSON.stringify({
    "isi_version": "1.0",
    "intent_id": "DEL-001",
    "compiled_outputs": {
      "claude_code": { "type": "prompt_prefix", "priority": "high" },
      "v0": { "type": "component_rules", "auto_inject": true },
      "devui_hmc": { "type": "skill_config", "mapping": "vue-devui-practices" },
      "figma_mcp": { "type": "design_lint", "severity": "ERROR" }
    }
  }, null, 2)
};

// LLM 输出数据
const llmOutputData = {
  ops: {
    before: `{
  "alert_level": "严重",
  "root_cause": "CPU 使用率超过阈值",
  "confidence_score": 0.85
}`,
    after: `{
  "alert_level": "Critical",
  "root_cause": "CPU 使用率超过阈值",
  "confidence_score": 0.85
}`
  },
  system: {
    sceneA: `{
  "scene": "system_alert",
  "color_token": "status.critical",
  "message": "系统故障"
}`,
    sceneB: `{
  "scene": "toast",
  "color_token": "status.critical",
  "message": "保存成功"
}`
  },
  frontend: {
    bad: `<Button variant="contained" color="primary">
  确认
</Button>`,
    good: `<Button variant="outline" color="danger">
  确认删除账户
</Button>
<ConfirmDialog />
<Alert severity="error">
  此操作不可恢复
</Alert>`
  },
  infra: {
    inputs: [
      { text: "Error in message stream", severity: "fatal" },
      { text: "network error", severity: "transient" },
      { text: "Too many requests", severity: "retryable" },
      { text: "Something went wrong", severity: "degraded" }
    ]
  },
  cross: {
    claude: `## 语义约束（来自 intent/DEL-001.yaml）
当生成删除账户相关代码时：
- 按钮必须使用 outline_danger 样式
- 必须包含二次确认弹窗
- 禁止生成 contained 主按钮`,
    v0: `{
  "match": "action_type == 'destructive'",
  "component": "Button",
  "props": { "variant": "outline", "color": "red" },
  "required_children": ["ConfirmDialog"]
}`,
    devui: `skill_name: vue-devui-practices
mapping:
  destructive_action:
    component: "d-button"
    props: { type: "danger", outline: true }
    required_modals: ["d-modal[confirm]"]
validation:
  if: "LLM_output.contains('<d-button type=\"primary\">')"
  then: "BLOCK"
  reason: "高危操作禁止使用 primary 样式"`,
    figma: `{
  "node_type": "BUTTON",
  "if": "label.contains('删除') && style != 'outline_danger'",
  "severity": "ERROR",
  "message": "删除按钮必须使用 outline_danger 样式"
}`
  }
};

// 推演结果
const validationData = {
  ops: {
    result: 'BLOCK',
    reason: 'synonym_substitution: "严重" 被映射为 Critical，但 v1.1 规则已拦截',
    layers: [
      { name: '语法推演', status: 'PASS', detail: 'JSON 结构完整' },
      { name: '语义推演', status: 'BLOCK', detail: '检测到 prohibited_synonym: "严重"' },
      { name: '安全推演', status: 'PASS', detail: '无禁止模式' },
      { name: '美感推演', status: 'WARN', detail: '文案长度偏短' }
    ]
  },
  system: {
    sceneA: {
      result: 'PASS',
      reason: 'scene: system_alert 允许使用 status.critical',
      layers: [
        { name: '语法推演', status: 'PASS', detail: '结构合法' },
        { name: '语义推演', status: 'PASS', detail: 'allowed_scenes 匹配' },
        { name: '安全推演', status: 'PASS', detail: '无风险' },
        { name: '美感推演', status: 'PASS', detail: '信息密度正常' }
      ]
    },
    sceneB: {
      result: 'BLOCK',
      reason: 'scene: toast 禁止使用 status.critical（应使用 status.success）',
      layers: [
        { name: '语法推演', status: 'PASS', detail: '结构合法' },
        { name: '语义推演', status: 'BLOCK', detail: 'prohibited_scenes 命中: toast' },
        { name: '安全推演', status: 'PASS', detail: '无风险' },
        { name: '美感推演', status: 'PASS', detail: '信息密度正常' }
      ]
    }
  },
  frontend: {
    bad: {
      result: 'BLOCK',
      reason: 'destructive_action 禁止使用 contained 主按钮样式',
      layers: [
        { name: '语法推演', status: 'PASS', detail: '组件结构合法' },
        { name: '语义推演', status: 'BLOCK', detail: 'button_style != outline_danger' },
        { name: '安全推演', status: 'BLOCK', detail: '缺少 confirmation_step' },
        { name: '美感推演', status: 'PASS', detail: '布局正常' }
      ]
    },
    good: {
      result: 'PASS',
      reason: 'destructive_action 约束全部满足',
      layers: [
        { name: '语法推演', status: 'PASS', detail: '组件结构合法' },
        { name: '语义推演', status: 'PASS', detail: 'button_style = outline_danger' },
        { name: '安全推演', status: 'PASS', detail: 'confirmation_step = true' },
        { name: '美感推演', status: 'PASS', detail: '信息密度正常' }
      ]
    }
  },
  infra: [
    { text: 'Error in message stream', severity: 'fatal', result: 'PASS', color: 'fatal' },
    { text: 'network error', severity: 'transient', result: 'PASS', color: 'transient' },
    { text: 'Too many requests', severity: 'retryable', result: 'PASS', color: 'retryable' },
    { text: 'Something went wrong', severity: 'degraded', result: 'PASS', color: 'degraded' }
  ]
};

// 跨工具数据
const crossToolData = {
  tools: [
    { id: 'claude_code', name: 'Claude Code', icon: '🔧', format: 'markdown' },
    { id: 'v0', name: 'v0 by Vercel', icon: '⚡', format: 'json' },
    { id: 'devui_hmc', name: 'DevUI HMC', icon: '🔷', format: 'yaml' },
    { id: 'figma_mcp', name: 'Figma MCP', icon: '🎨', format: 'json' }
  ]
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initCover();
  initScenes();
  initCrossTool();
  switchScene('cover');
});

function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const sceneId = item.dataset.scene;
      switchScene(sceneId);
    });
  });
}

function switchScene(sceneId) {
  // 更新导航
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.scene === sceneId);
  });

  // 更新场景
  document.querySelectorAll('.scene-container').forEach(container => {
    container.classList.toggle('active', container.id === `scene-${sceneId}`);
  });

  // 更新标题
  const scene = scenes[sceneId];
  if (scene) {
    document.getElementById('page-title').textContent = scene.title;
    document.getElementById('page-desc').textContent = scene.desc;
  }

  // 特殊处理
  if (sceneId === 'cross') {
    switchToolTab('claude_code');
  }
}

function initCover() {
  // 封面页数据已内联在 HTML 中
}

function initScenes() {
  // 渲染 YAML
  Object.keys(yamlData).forEach(key => {
    const el = document.getElementById(`yaml-${key}`);
    if (el) el.innerHTML = highlightYaml(yamlData[key]);
  });

  // 渲染 JSON Schema
  Object.keys(jsonSchemaData).forEach(key => {
    const el = document.getElementById(`json-${key}`);
    if (el) el.innerHTML = highlightJson(jsonSchemaData[key]);
  });

  // 渲染 LLM 输出
  initLlmOutputs();

  // 渲染推演
  initValidations();

  // 渲染 UI 预览
  initUiPreviews();
}

function initLlmOutputs() {
  // Ops
  const opsEl = document.getElementById('llm-ops');
  if (opsEl) {
    opsEl.innerHTML = `
      <div style="margin-bottom:12px; padding:8px; background:#1a1a1a; border-radius:6px; border-left:3px solid #ef4444;">
        <div style="font-size:10px; color:#666; margin-bottom:4px;">❌ LLM 输出（违规）</div>
        <pre style="margin:0; color:#fca5a5;">${llmOutputData.ops.before}</pre>
      </div>
      <div style="padding:8px; background:#1a1a1a; border-radius:6px; border-left:3px solid #10b981;">
        <div style="font-size:10px; color:#666; margin-bottom:4px;">✅ 约束后输出（合规）</div>
        <pre style="margin:0; color:#86efac;">${llmOutputData.ops.after}</pre>
      </div>
    `;
  }

  // System
  const sysEl = document.getElementById('llm-system');
  if (sysEl) {
    sysEl.innerHTML = `
      <div style="margin-bottom:12px; padding:8px; background:#1a1a1a; border-radius:6px; border-left:3px solid #10b981;">
        <div style="font-size:10px; color:#666; margin-bottom:4px;">✅ 场景 A：system_alert（合法）</div>
        <pre style="margin:0; color:#86efac;">${llmOutputData.system.sceneA}</pre>
      </div>
      <div style="padding:8px; background:#1a1a1a; border-radius:6px; border-left:3px solid #ef4444;">
        <div style="font-size:10px; color:#666; margin-bottom:4px;">❌ 场景 B：toast（违规）</div>
        <pre style="margin:0; color:#fca5a5;">${llmOutputData.system.sceneB}</pre>
      </div>
    `;
  }

  // Frontend
  const feEl = document.getElementById('llm-frontend');
  if (feEl) {
    feEl.innerHTML = `
      <div style="margin-bottom:12px; padding:8px; background:#1a1a1a; border-radius:6px; border-left:3px solid #ef4444;">
        <div style="font-size:10px; color:#666; margin-bottom:4px;">❌ AI 默认生成（违规）</div>
        <pre style="margin:0; color:#fca5a5;">${escapeHtml(llmOutputData.frontend.bad)}</pre>
      </div>
      <div style="padding:8px; background:#1a1a1a; border-radius:6px; border-left:3px solid #10b981;">
        <div style="font-size:10px; color:#666; margin-bottom:4px;">✅ 语义约束后（合规）</div>
        <pre style="margin:0; color:#86efac;">${escapeHtml(llmOutputData.frontend.good)}</pre>
      </div>
    `;
  }

  // Infra
  const infEl = document.getElementById('llm-infra');
  if (infEl) {
    infEl.innerHTML = llmOutputData.infra.inputs.map((item, i) => `
      <div style="margin-bottom:8px; padding:8px; background:#1a1a1a; border-radius:6px; font-size:11px;">
        <div style="color:#888; margin-bottom:4px;">输入 ${i+1}: "${item.text}"</div>
        <div style="color:#7dd3fc;">→ 推演为: <strong>${item.severity}</strong></div>
      </div>
    `).join('');
  }
}

function initValidations() {
  // Ops
  const opsEl = document.getElementById('val-ops');
  if (opsEl) {
    const d = validationData.ops;
    opsEl.innerHTML = renderValidation(d);
  }

  // System
  const sysEl = document.getElementById('val-system');
  if (sysEl) {
    const d = validationData.system.sceneB;
    sysEl.innerHTML = renderValidation(d);
  }

  // Frontend
  const feEl = document.getElementById('val-frontend');
  if (feEl) {
    const d = validationData.frontend.bad;
    feEl.innerHTML = renderValidation(d);
  }

  // Infra
  const infEl = document.getElementById('val-infra');
  if (infEl) {
    infEl.innerHTML = validationData.infra.map(item => `
      <div style="margin-bottom:8px; padding:10px; background:#1a1a1a; border-radius:6px; border-left:3px solid #10b981;">
        <div style="font-size:11px; color:#86efac; margin-bottom:4px;">✅ PASS: "${item.text}"</div>
        <div style="font-size:10px; color:#888;">语义推演: ${item.severity} → 视觉映射: ${item.color}</div>
      </div>
    `).join('');
  }
}

function renderValidation(data) {
  const resultClass = data.result === 'PASS' ? 'pass' : data.result === 'BLOCK' ? 'block' : 'warn';
  const resultIcon = data.result === 'PASS' ? '✅' : data.result === 'BLOCK' ? '❌' : '⚠️';

  let html = `
    <div class="validation-result ${resultClass}" style="margin-bottom:16px;">
      <div style="font-weight:600; margin-bottom:6px;">${resultIcon} ${data.result}</div>
      <div style="font-size:11px; opacity:0.9;">${data.reason}</div>
    </div>
  `;

  html += '<div style="display:flex; flex-direction:column; gap:6px;">';
  data.layers.forEach(layer => {
    const lClass = layer.status === 'PASS' ? 'pass' : layer.status === 'BLOCK' ? 'block' : 'warn';
    const lIcon = layer.status === 'PASS' ? '✓' : layer.status === 'BLOCK' ? '✗' : '!';
    html += `
      <div style="padding:8px; background:#1a1a1a; border-radius:6px; font-size:11px; display:flex; justify-content:space-between; align-items:center;">
        <span style="color:#888;">${layer.name}</span>
        <span style="color:${layer.status === 'PASS' ? '#10b981' : layer.status === 'BLOCK' ? '#ef4444' : '#f59e0b'}; font-weight:600;">${lIcon} ${layer.status}</span>
      </div>
      <div style="font-size:10px; color:#666; padding-left:8px; margin-bottom:4px;">${layer.detail}</div>
    `;
  });
  html += '</div>';

  return html;
}

function initUiPreviews() {
  // Ops: 告警卡片对比
  const opsUi = document.getElementById('ui-ops');
  if (opsUi) {
    opsUi.innerHTML = `
      <div style="width:100%; margin-bottom:12px;">
        <div style="font-size:10px; color:#666; margin-bottom:6px;">❌ 违规渲染</div>
        <div class="alert-card" style="background:rgba(239,68,68,0.15); border-color:rgba(239,68,68,0.4); color:#fca5a5;">
          <span>⚠️</span>
          <div>
            <div style="font-weight:600;">系统告警</div>
            <div style="font-size:11px; opacity:0.8; margin-top:2px;">级别: 严重</div>
          </div>
        </div>
      </div>
      <div style="width:100%;">
        <div style="font-size:10px; color:#666; margin-bottom:6px;">✅ 合规渲染</div>
        <div class="alert-card" style="background:rgba(239,68,68,0.15); border-color:rgba(239,68,68,0.4); color:#fca5a5;">
          <span>🚨</span>
          <div>
            <div style="font-weight:600;">系统告警</div>
            <div style="font-size:11px; opacity:0.8; margin-top:2px;">级别: Critical</div>
          </div>
        </div>
      </div>
    `;
  }

  // System: 场景对比
  const sysUi = document.getElementById('ui-system');
  if (sysUi) {
    sysUi.innerHTML = `
      <div style="width:100%; margin-bottom:12px;">
        <div style="font-size:10px; color:#666; margin-bottom:6px;">✅ 告警场景（合法）</div>
        <div class="alert-card alert-fatal">
          <span>🚨</span>
          <div>系统故障，请立即处理</div>
        </div>
      </div>
      <div style="width:100%;">
        <div style="font-size:10px; color:#666; margin-bottom:6px;">❌ Toast 场景（违规）</div>
        <div class="alert-card" style="background:rgba(239,68,68,0.15); border-color:rgba(239,68,68,0.4); color:#fca5a5; opacity:0.5;">
          <span>🚨</span>
          <div>保存成功（错误使用红色）</div>
        </div>
        <div style="font-size:10px; color:#10b981; margin-top:6px;">→ 应使用绿色: 保存成功</div>
      </div>
    `;
  }

  // Frontend: 按钮对比
  const feUi = document.getElementById('ui-frontend');
  if (feUi) {
    feUi.innerHTML = `
      <div style="width:100%; margin-bottom:16px;">
        <div style="font-size:10px; color:#666; margin-bottom:8px;">❌ AI 默认生成</div>
        <div style="padding:16px; background:#1a1a1a; border-radius:8px; text-align:center;">
          <div style="font-size:13px; margin-bottom:12px;">确认删除账户？</div>
          <button class="btn-preview btn-contained">确认</button>
        </div>
      </div>
      <div style="width:100%;">
        <div style="font-size:10px; color:#666; margin-bottom:8px;">✅ 语义约束后</div>
        <div style="padding:16px; background:#1a1a1a; border-radius:8px; text-align:center; border:1px solid #333;">
          <div style="font-size:12px; color:#fca5a5; margin-bottom:8px;">⚠️ 此操作不可恢复</div>
          <div style="font-size:11px; color:#888; margin-bottom:12px;">请输入账户名确认删除</div>
          <div style="display:flex; gap:8px; justify-content:center;">
            <button style="padding:6px 12px; border-radius:4px; border:1px solid #444; background:transparent; color:#888; font-size:12px;">取消</button>
            <button class="btn-preview btn-outline-danger">确认删除账户</button>
          </div>
        </div>
      </div>
    `;
  }

  // Infra: 四种错误状态
  const infUi = document.getElementById('ui-infra');
  if (infUi) {
    infUi.innerHTML = `
      <div style="width:100%; display:flex; flex-direction:column; gap:8px;">
        <div class="alert-card alert-fatal pulse-red">
          <span>🚨</span>
          <div>
            <div style="font-weight:600;">消息流中断</div>
            <div style="font-size:10px; margin-top:2px; opacity:0.8;">对话可能已丢失，建议刷新</div>
            <div style="margin-top:6px;">
              <button style="font-size:10px; padding:3px 8px; background:rgba(239,68,68,0.3); border:1px solid rgba(239,68,68,0.5); color:#fca5a5; border-radius:3px;">刷新页面</button>
            </div>
          </div>
        </div>
        <div class="alert-card alert-transient">
          <span><div class="spinner"></div></span>
          <div>
            <div style="font-weight:600;">网络不稳定</div>
            <div style="font-size:10px; margin-top:2px; opacity:0.8;">正在自动重试，无需操作</div>
          </div>
        </div>
        <div class="alert-card alert-retryable">
          <span>⏰</span>
          <div>
            <div style="font-weight:600;">请求频率已达上限</div>
            <div style="font-size:10px; margin-top:2px; opacity:0.8;">42 分钟后自动恢复</div>
          </div>
        </div>
        <div class="alert-card alert-degraded">
          <span>ℹ️</span>
          <div>
            <div style="font-weight:600;">部分响应生成失败</div>
            <div style="font-size:10px; margin-top:2px; opacity:0.8;">已生成内容仍然有效</div>
            <div style="margin-top:6px;">
              <button style="font-size:10px; padding:3px 8px; background:rgba(59,130,246,0.3); border:1px solid rgba(59,130,246,0.5); color:#93c5fd; border-radius:3px;">继续生成</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

// 跨工具场景
function initCrossTool() {
  const tabsContainer = document.getElementById('tool-tabs');
  if (!tabsContainer) return;

  crossToolData.tools.forEach(tool => {
    const tab = document.createElement('div');
    tab.className = 'tool-tab';
    tab.dataset.tool = tool.id;
    tab.innerHTML = `<span style="margin-right:4px;">${tool.icon}</span>${tool.name}`;
    tab.addEventListener('click', () => switchToolTab(tool.id));
    tabsContainer.appendChild(tab);
  });
}

function switchToolTab(toolId) {
  document.querySelectorAll('.tool-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tool === toolId);
  });

  const content = document.getElementById('cross-content');
  if (!content) return;

  const outputs = llmOutputData.cross;
  let html = '';

  switch(toolId) {
    case 'claude_code':
      html = `
        <div style="padding:16px;">
          <div style="font-size:11px; color:#666; margin-bottom:8px;">编译产物：Prompt 前缀（Markdown）</div>
          <div style="padding:12px; background:#0d0d0d; border-radius:6px; border:1px solid #222; font-family:monospace; font-size:11px; line-height:1.6; color:#ccc; white-space:pre-wrap;">${escapeHtml(outputs.claude)}</div>
          <div style="margin-top:12px; font-size:11px; color:#888;">注入点: System Prompt | 优先级: High</div>
        </div>
      `;
      break;
    case 'v0':
      html = `
        <div style="padding:16px;">
          <div style="font-size:11px; color:#666; margin-bottom:8px;">编译产物：组件规则（JSON）</div>
          <div style="padding:12px; background:#0d0d0d; border-radius:6px; border:1px solid #222; font-family:monospace; font-size:11px; line-height:1.6; color:#ccc; white-space:pre-wrap;">${escapeHtml(outputs.v0)}</div>
          <div style="margin-top:12px; font-size:11px; color:#888;">自动注入: v0 生成规则引擎</div>
        </div>
      `;
      break;
    case 'devui_hmc':
      html = `
        <div style="padding:16px;">
          <div style="font-size:11px; color:#666; margin-bottom:8px;">编译产物：Skill 配置（YAML）</div>
          <div style="padding:12px; background:#0d0d0d; border-radius:6px; border:1px solid #222; font-family:monospace; font-size:11px; line-height:1.6; color:#ccc; white-space:pre-wrap;">${escapeHtml(outputs.devui)}</div>
          <div style="margin-top:12px; font-size:11px; color:#888;">Skill: vue-devui-practices | 校验: BLOCK 违规输出</div>
        </div>
      `;
      break;
    case 'figma_mcp':
      html = `
        <div style="padding:16px;">
          <div style="font-size:11px; color:#666; margin-bottom:8px;">编译产物：设计 Lint 规则（JSON）</div>
          <div style="padding:12px; background:#0d0d0d; border-radius:6px; border:1px solid #222; font-family:monospace; font-size:11px; line-height:1.6; color:#ccc; white-space:pre-wrap;">${escapeHtml(outputs.figma)}</div>
          <div style="margin-top:12px; font-size:11px; color:#888;">插件: Figma MCP | 违规: 节点标红圈</div>
        </div>
      `;
      break;
  }

  content.innerHTML = html;
}

// 语法高亮
function highlightYaml(code) {
  return code
    .replace(/^(\s*#.*)$/gm, '<span class="yaml-comment">$1</span>')
    .replace(/^(\s*[\w_\.]+:)/gm, '<span class="yaml-key">$1</span>')
    .replace(/: (".*?")/g, ': <span class="yaml-string">$1</span>')
    .replace(/^(\s*\+.*)$/gm, '<span class="yaml-highlight">$1</span>');
}

function highlightJson(code) {
  return code
    .replace(/"(\w+)":/g, '<span class="json-key">"$1":</span>')
    .replace(/: (".*?")/g, ': <span class="json-string">$1</span>')
    .replace(/: (true|false)/g, ': <span class="json-bool">$1</span>');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
