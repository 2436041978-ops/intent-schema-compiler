const app = {
    // ... schema 定义保持不变 ...

    mockOutputs: {
        valid: {
            label: "✅ 合规输出",
            yamlLayer: "语义层",
            yamlFile: "semantic-tokens.yaml",
            yamlRef: "intent-schema.json → semantic-tokens.yaml",
            yamlSource: `semantic_tokens:
  status.critical:
    canonical_id: "ST-001"
    immutable: true
    description: "系统级故障，需立即响应"
    visual_mapping:
      color_token: "status.critical"
      motion_token: "pulse.red.urgent"
    llm_constraints:
      - "生成内容必须包含明确的故障定位信息"
      - "禁止提供未经验证的修复建议"
      - "必须附带人工升级路径"`,
            data: {
                alert_level: "P0",
                root_cause: "CPU 使用率超过阈值，导致服务响应延迟",
                confidence_score: 0.85,
                remediation: [{ action_type: "manual", description: "检查内存占用进程" }]
            },
            expected: "PASS"
        },
        synonym: {
            label: "❌ 语义漂移",
            yamlLayer: "约束层",
            yamlFile: "synonym-mapping.yaml",
            yamlRef: "semantic-tokens.yaml → synonym-mapping.yaml",
            yamlSource: `synonym_mapping:
  - term: "严重"
    standard_token: "critical"
    allowed_contexts: ["AW-001", "AW-002"]
    # 当前意图 AW-003 不在允许列表中
    # 触发：语义推演 BLOCK`,
            data: {
                alert_level: "严重",
                root_cause: "CPU 使用率超过阈值，导致服务响应延迟",
                confidence_score: 0.85
            },
            expected: "BLOCK",
            errors: [{
                tier: "semantic",
                rule: "SEM-001",
                message: 'Value "严重" is not defined in enum ["P0","P1","P2","P3"]',
                ref: "#/properties/alert_level/Enum"
            }]
        },
        length: {
            label: "❌ 信息不足",
            yamlLayer: "约束层",
            yamlFile: "response-schema.yaml",
            yamlRef: "intent-schema.json → response-schema.yaml",
            yamlSource: `response_schema:
  required_fields:
    - field: "root_cause"
      type: "string"
      min_length: 10        # ← 当前 3 字符，未达标
      max_length: 200`,
            data: {
                alert_level: "P0",
                root_cause: "CPU",
                confidence_score: 0.85
            },
            expected: "BLOCK",
            errors: [{
                tier: "syntax",
                rule: "SYN-002",
                message: "String 'CPU' is less than minimum length of 10",
                ref: "#/properties/root_cause/MinimumLength"
            }]
        },
        confidence: {
            label: "❌ 数值越界",
            yamlLayer: "约束层",
            yamlFile: "response-schema.yaml",
            yamlRef: "intent-schema.json → response-schema.yaml",
            yamlSource: `response_schema:
  required_fields:
    - field: "confidence_score"
      type: "number"
      minimum: 0.0
      maximum: 1.0          # ← 当前 1.5，超出上限`,
            data: {
                alert_level: "P0",
                root_cause: "CPU 使用率超过阈值，导致服务响应延迟",
                confidence_score: 1.5
            },
            expected: "BLOCK",
            errors: [{
                tier: "syntax",
                rule: "SYN-003",
                message: "Float 1.5 exceeds maximum value of 1",
                ref: "#/properties/confidence_score/Maximum"
            }]
        },
        safety: {
            label: "❌ 安全偏差",
            yamlLayer: "约束层",
            yamlFile: "human-ai-boundary.yaml",
            yamlRef: "intent-schema.json → human-ai-boundary.yaml",
            yamlSource: `human_ai_boundary:
  destructive-action:
    ai_prohibited:
      - "直接执行修复操作"
      - "修改告警阈值配置"
      - "关闭或忽略告警"
    # action_type: "automated" 命中上述禁止项`,
            data: {
                alert_level: "P0",
                root_cause: "CPU 使用率超过阈值，导致服务响应延迟",
                confidence_score: 0.85,
                remediation: [{ action_type: "automated", description: "自动修复" }]
            },
            expected: "BLOCK",
            errors: [{
                tier: "safety",
                rule: "SAF-001",
                message: "命中安全禁止模式: action_type='automated'",
                ref: "rules/safety/destructive.yaml"
            }]
        },
        multi: {
            label: "❌ 复合偏差",
            yamlLayer: "验证层",
            yamlFile: "scenario-tests.yaml",
            yamlRef: "human-ai-boundary.yaml → scenario-tests.yaml",
            yamlSource: `scenario_tests:
  - case: "复合偏差"
    mock_response:
      alert_level: "严重"      # 语义层违规
      root_cause: "CPU"        # 约束层违规
      confidence_score: 1.5    # 约束层违规
    expected_validation: "BLOCK"`,
            data: {
                alert_level: "严重",
                root_cause: "CPU",
                confidence_score: 1.5
            },
            expected: "BLOCK",
            errors: [
                { tier: "semantic", rule: "SEM-001", message: 'Value "严重" is not defined in enum', ref: "#/properties/alert_level/Enum" },
                { tier: "syntax", rule: "SYN-002", message: "String 'CPU' is less than minimum length of 10", ref: "#/properties/root_cause/MinimumLength" },
                { tier: "syntax", rule: "SYN-003", message: "Float 1.5 exceeds maximum value of 1", ref: "#/properties/confidence_score/Maximum" }
            ]
        }
    },

    init() {
        this.selector = document.getElementById('llm-selector');
        this.yamlDisplay = document.getElementById('yaml-display');
        this.yamlBadge = document.getElementById('yaml-badge');
        this.yamlPath = document.getElementById('yaml-path');
        this.yamlRef = document.getElementById('yaml-ref');
        this.schemaDisplay = document.getElementById('schema-display');
        this.jsonDisplay = document.getElementById('json-display');
        this.tierResults = document.getElementById('tier-results');
        this.finalVerdict = document.getElementById('final-verdict');
        this.alertCard = document.getElementById('alert-card');
        this.blockOverlay = document.getElementById('block-overlay');
        this.blockReason = document.getElementById('block-reason');

        this.schemaDisplay.textContent = JSON.stringify(this.schema, null, 2);

        this.selector.addEventListener('change', (e) => this.run(e.target.value));
        this.run('valid');
    },

    run(key) {
        const scenario = this.mockOutputs[key];
        const data = scenario.data;

        // 渲染 YAML 源文件
        this.yamlDisplay.textContent = scenario.yamlSource;
        this.yamlBadge.textContent = scenario.yamlLayer;
        this.yamlBadge.className = 'badge ' + 
            (scenario.yamlLayer === '语义层' ? '' : 
             scenario.yamlLayer === '约束层' ? 'governance' : 'validation');
        this.yamlPath.textContent = `intent-schema-compiler/${scenario.yamlLayer === '语义层' ? '语义层' : scenario.yamlLayer === '约束层' ? '约束层' : '验证层'}/${scenario.yamlFile}`;
        this.yamlRef.textContent = scenario.yamlRef;

        // 渲染 JSON
        this.jsonDisplay.textContent = JSON.stringify(data, null, 2);

        // 执行推演（保持不变）
        const result = this.validate(data, scenario.errors || []);
        this.renderTiers(result);
        this.renderVerdict(result.passed);

        if (result.passed) {
            this.renderCard(data);
            this.hideBlock();
        } else {
            this.renderCard(data, true);
            this.showBlock(result.errors[0]);
        }
    },

    // ... validate、renderTiers、renderVerdict、renderCard、showBlock、hideBlock、reset 保持不变 ...
};
