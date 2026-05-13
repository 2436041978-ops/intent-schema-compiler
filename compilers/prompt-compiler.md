# Prompt Compiler -- 思维链

> **版本**: v1.0 | **类型**: 编译器伪代码规范 | **状态**: 稳定

---

## 1. 概述

**Prompt Compiler** 是 Intent-Schema-Compiler 体系中的核心编译前端，负责将**意图定义（Intent Schema）**、**语义令牌（Semantic Tokens）** 与 **输入约束（Input Constraints）** 编译为面向 LLM 的结构化 Prompt。

### 1.1 设计哲学

编译器遵循"契约即代码"（Contract-as-Code）的理念：意图 Schema 本身即是一份形式化契约，Prompt Compiler 的任务是将这份契约无损地转译为 LLM 可理解的指令集，确保生成输出在语法、结构、语义、业务四个维度均符合预期。

### 1.2 编译目标

| 目标维度 | 说明 |
|---------|------|
| **结构化** | 输出严格遵循 JSON Schema 定义的结构 |
| **类型安全** | 所有字段类型与 Schema 定义一致 |
| **语义精确** | 语义令牌被正确解析为规范形式 |
| **约束满足** | 所有输入约束在 Prompt 中被显式声明 |

### 1.3 整体架构

```
+-------------------+     +-------------------+     +-------------------+
|   Intent Schema   | --> |  Prompt Compiler  | --> | Structured Prompt |
|   (意图定义)       |     |   (四步编译)       |     | (结构化指令)       |
+-------------------+     +-------------------+     +-------------------+
         |                          ^
         v                          |
+-------------------+               |
|  Semantic Tokens  |---------------+
|  (语义令牌词典)    |
+-------------------+
         |
         v
+-------------------+
| Input Constraints |
| (输入约束条件)    |
+-------------------+
```

---

## 2. 编译流程

编译器采用四步流水线架构，每步均为纯函数变换，输入输出明确，支持链式追踪与调试。

### 步骤总览

| 步骤 | 名称 | 输入 | 输出 | 核心操作 |
|------|------|------|------|----------|
| **Step 1** | 加载 Intent Schema | YAML/JSON 意图定义 | 结构化 Schema AST | 解析与验证 |
| **Step 2** | 解析语义令牌 | Schema AST + Token 词典 | 令牌替换后的 Schema | 令牌规范化 |
| **Step 3** | 构建输入边界 | 约束条件 + Prompt 模板 | 注入约束的模板 | 边界注入 |
| **Step 4** | 生成最终 Prompt | 完整模板 + 元数据 | 结构化 Prompt 字符串 | 组装输出 |

---

### Step 1: 加载 Intent Schema（读取意图定义）

**目标**：从磁盘或内存加载意图 Schema 定义，解析为编译器内部的抽象语法树（AST），并进行基础合法性验证。

**输入输出**：

| 属性 | 值 |
|------|-----|
| **输入** | 意图 Schema 文件路径 或 原始 YAML/JSON 字符串 |
| **输出** | `SchemaAST` 对象（包含 intent_name, fields, constraints, metadata） |
| **错误处理** | 文件不存在/解析失败时抛出 `SchemaLoadError` |

```pseudocode
FUNCTION LoadIntentSchema(source: String | FilePath): SchemaAST
    // 1.1 读取原始内容
    IF source IS FilePath THEN
        rawContent = READ_FILE(source)
    ELSE
        rawContent = source
    END IF

    // 1.2 解析序列化格式
    IF rawContent.STARTS_WITH("{") OR rawContent.STARTS_WITH("[") THEN
        parsed = JSON_PARSE(rawContent)
    ELSE
        parsed = YAML_PARSE(rawContent)
    END IF

    // 1.3 构建 AST 节点
    ast = NEW SchemaAST()
    ast.intent_name    = parsed.intent
    ast.version        = parsed.version OR "1.0"
    ast.description    = parsed.description
    ast.fields         = MAP(parsed.fields, f -> ParseFieldNode(f))
    ast.constraints    = MAP(parsed.constraints, c -> ParseConstraintNode(c))
    ast.semantic_refs  = EXTRACT_SEMANTIC_REFERENCES(parsed)
    ast.metadata       = parsed.metadata OR EMPTY_MAP

    // 1.4 基础合法性验证
    ASSERT ast.intent_name IS NOT EMPTY
        THROW SchemaLoadError("intent_name is required")
    ASSERT LENGTH(ast.fields) > 0
        THROW SchemaLoadError("at least one field must be defined")
    ASSERT ALL(ast.fields, f -> f.name IS NOT EMPTY AND f.type IS NOT EMPTY)
        THROW SchemaLoadError("all fields must have name and type")

    // 1.5 构建字段依赖图（用于后续校验）
    ast.dependency_graph = BUILD_DEPENDENCY_GRAPH(ast.fields)

    RETURN ast
END FUNCTION
```

**辅助函数**：

```pseudocode
FUNCTION ParseFieldNode(fieldDef: Object): FieldNode
    node = NEW FieldNode()
    node.name        = fieldDef.name
    node.type        = fieldDef.type          // string | number | boolean | enum | array | object
    node.required    = fieldDef.required ?? TRUE
    node.description = fieldDef.description
    node.semantic_token = fieldDef.semantic  // 如 "$PRIORITY_LEVEL"
    node.validation  = fieldDef.validation   // 附加校验规则
    node.default     = fieldDef.default
    RETURN node
END FUNCTION

FUNCTION ParseConstraintNode(constraintDef: Object): ConstraintNode
    node = NEW ConstraintNode()
    node.type        = constraintDef.type     // range | regex | enum_set | custom
    node.target_field = constraintDef.field
    node.rule        = constraintDef.rule
    node.severity    = constraintDef.severity // error | warning
    RETURN node
END FUNCTION
```

---

### Step 2: 解析语义令牌（将语义令牌替换为规范形式）

**目标**：扫描 Schema AST 中所有字段的 `semantic_token` 引用，将其替换为语义令牌词典中定义的规范形式（包含类型定义、枚举值、描述等）。

**输入输出**：

| 属性 | 值 |
|------|-----|
| **输入** | `SchemaAST`（来自 Step 1）+ `TokenDictionary`（语义令牌词典） |
| **输出** | `ResolvedSchemaAST`（所有语义令牌已解析替换） |
| **错误处理** | 未知令牌引用时抛出 `UnknownTokenError` |

```pseudocode
FUNCTION ResolveSemanticTokens(
    ast: SchemaAST,
    tokenDict: TokenDictionary
): ResolvedSchemaAST

    resolved = NEW ResolvedSchemaAST()
    resolved.intent_name    = ast.intent_name
    resolved.version        = ast.version
    resolved.description    = ast.description
    resolved.metadata       = ast.metadata
    resolved.constraints    = ast.constraints
    resolved.dependency_graph = ast.dependency_graph

    // 2.1 深度优先遍历所有字段，解析语义令牌
    resolved.fields = MAP(ast.fields, field ->
        ResolveFieldTokens(field, tokenDict)
    )

    // 2.2 验证令牌解析完整性
    unresolved = FILTER(resolved.fields, f ->
        f.semantic_token IS NOT NULL AND f.resolved_value IS NULL
    )
    IF LENGTH(unresolved) > 0 THEN
        THROW UnknownTokenError(
            "Unresolved semantic tokens: " + JOIN(unresolved, ", ")
        )
    END IF

    RETURN resolved
END FUNCTION

FUNCTION ResolveFieldTokens(field: FieldNode, tokenDict: TokenDictionary): ResolvedFieldNode
    resolvedField = NEW ResolvedFieldNode()
    resolvedField.name         = field.name
    resolvedField.type         = field.type
    resolvedField.required     = field.required
    resolvedField.description  = field.description
    resolvedField.default      = field.default
    resolvedField.validation   = field.validation
    resolvedField.semantic_token = field.semantic_token

    // 2.3 解析语义令牌引用
    IF field.semantic_token IS NOT NULL THEN
        tokenName = EXTRACT_TOKEN_NAME(field.semantic_token)
            // "$PRIORITY_LEVEL" -> "PRIORITY_LEVEL"

        IF NOT CONTAINS(tokenDict, tokenName) THEN
            THROW UnknownTokenError(
                "Semantic token '" + tokenName + "' not found in dictionary"
            )
        END IF

        tokenDef = tokenDict[tokenName]
        resolvedField.resolved_value = tokenDef

        // 2.4 类型一致性校验：令牌类型必须与字段类型兼容
        IF NOT IsTypeCompatible(field.type, tokenDef.value_type) THEN
            THROW TokenTypeMismatchError(
                "Field '" + field.name + "' type " + field.type +
                " is incompatible with token type " + tokenDef.value_type
            )
        END IF

        // 2.5 融合令牌描述到字段描述
        IF resolvedField.description IS NULL AND tokenDef.description IS NOT NULL THEN
            resolvedField.description = tokenDef.description
        END IF
    END IF

    // 2.6 递归处理嵌套字段（object / array 类型）
    IF field.type == "object" AND field.fields IS NOT NULL THEN
        resolvedField.fields = MAP(field.fields, f -> ResolveFieldTokens(f, tokenDict))
    ELSE IF field.type == "array" AND field.item_schema IS NOT NULL THEN
        resolvedField.item_schema = ResolveFieldTokens(field.item_schema, tokenDict)
    END IF

    RETURN resolvedField
END FUNCTION

FUNCTION IsTypeCompatible(fieldType: String, tokenType: String): Boolean
    // 类型兼容性矩阵
    compatibility = {
        "string":  ["string", "enum"],
        "number":  ["number", "integer", "range"],
        "boolean": ["boolean"],
        "enum":    ["enum", "string"],
        "array":   ["array"],
        "object":  ["object"]
    }
    RETURN CONTAINS(compatibility[fieldType] OR [], tokenType)
END FUNCTION
```

---

### Step 3: 构建输入边界（注入约束条件到 Prompt 模板）

**目标**：将解析后的 Schema 与输入约束条件融合，生成带有严格边界声明的 Prompt 模板。此步骤确保 LLM 明确知晓每个字段的取值范围、格式要求和业务规则。

**输入输出**：

| 属性 | 值 |
|------|-----|
| **输入** | `ResolvedSchemaAST`（来自 Step 2）+ `InputConstraints`（运行时输入约束） |
| **输出** | `PromptTemplate`（带有边界标记的模板对象） |
| **错误处理** | 约束冲突时抛出 `ConstraintConflictError` |

```pseudocode
FUNCTION BuildInputBoundaries(
    resolvedAst: ResolvedSchemaAST,
    inputConstraints: InputConstraints
): PromptTemplate

    template = NEW PromptTemplate()
    template.intent_name = resolvedAst.intent_name
    template.sections   = []

    // 3.1 构建角色定义段
    roleSection = NEW TemplateSection()
    roleSection.name = "role_definition"
    roleSection.content = BUILD_ROLE_TEXT(resolvedAst.description)
    APPEND template.sections, roleSection

    // 3.2 构建输出格式段（JSON Schema 描述）
    formatSection = NEW TemplateSection()
    formatSection.name = "output_format"
    formatSection.content = GENERATE_JSON_SCHEMA_DESC(resolvedAst.fields)
    APPEND template.sections, formatSection

    // 3.3 构建字段约束段（逐字段注入边界）
    constraintsSection = NEW TemplateSection()
    constraintsSection.name = "field_constraints"
    constraintsSection.content = JOIN(
        MAP(resolvedAst.fields, f -> BuildFieldConstraintBlock(f, inputConstraints)),
        "\n"
    )
    APPEND template.sections, constraintsSection

    // 3.4 构建全局约束段
    globalSection = NEW TemplateSection()
    globalSection.name = "global_constraints"
    globalSection.content = BuildGlobalConstraints(
        resolvedAst.constraints,
        inputConstraints
    )
    APPEND template.sections, globalSection

    // 3.5 构建语义规范段（解析后的令牌定义）
    semanticSection = NEW TemplateSection()
    semanticSection.name = "semantic_specifications"
    semanticSection.content = BuildSemanticSpecs(resolvedAst.fields)
    APPEND template.sections, semanticSection

    // 3.6 验证约束一致性
    conflicts = DETECT_CONSTRAINT_CONFLICTS(
        resolvedAst.constraints,
        inputConstraints
    )
    IF LENGTH(conflicts) > 0 THEN
        THROW ConstraintConflictError(
            "Constraint conflicts detected: " + SERIALIZE(conflicts)
        )
    END IF

    RETURN template
END FUNCTION

FUNCTION BuildFieldConstraintBlock(field: ResolvedFieldNode, inputConstraints: InputConstraints): String
    lines = []
    APPEND lines, "## Field: '" + field.name + "'"
    APPEND lines, "- Type: " + field.type

    IF field.required THEN
        APPEND lines, "- Required: YES (must be present and non-null)"
    ELSE
        APPEND lines, "- Required: NO (may be omitted)"
    END IF

    IF field.description IS NOT NULL THEN
        APPEND lines, "- Description: " + field.description
    END IF

    // 3.3.1 注入语义令牌解析后的规范
    IF field.resolved_value IS NOT NULL THEN
        token = field.resolved_value
        APPEND lines, "- Semantic Definition:"
        APPEND lines, "  - Canonical Type: " + token.value_type
        IF token.allowed_values IS NOT NULL THEN
            APPEND lines, "  - Allowed Values: " + JOIN(token.allowed_values, ", ")
        END IF
        IF token.format_pattern IS NOT NULL THEN
            APPEND lines, "  - Format: " + token.format_pattern
        END IF
    END IF

    // 3.3.2 注入运行时输入约束
    runtimeConstraint = FIND(inputConstraints, c -> c.field == field.name)
    IF runtimeConstraint IS NOT NULL THEN
        APPEND lines, "- Runtime Constraints:"
        APPEND lines, "  - " + runtimeConstraint.rule_description
    END IF

    // 3.3.3 注入字段级校验规则
    IF field.validation IS NOT NULL THEN
        APPEND lines, "- Validation Rules:"
        FOR rule IN field.validation
            APPEND lines, "  - " + rule.description + " [severity: " + rule.severity + "]"
        END FOR
    END IF

    IF field.default IS NOT NULL THEN
        APPEND lines, "- Default Value: " + SERIALIZE(field.default)
    END IF

    RETURN JOIN(lines, "\n")
END FUNCTION

FUNCTION BuildGlobalConstraints(schemaConstraints: List<ConstraintNode>, inputConstraints: InputConstraints): String
    lines = []
    APPEND lines, "## Global Constraints"

    // Schema 定义的约束
    FOR constraint IN schemaConstraints
        APPEND lines, "- " + constraint.type + ": " + constraint.rule +
                       " [applies to: " + constraint.target_field + "]"
    END FOR

    // 输入约束中的全局约束
    globalInputConstraints = FILTER(inputConstraints, c -> c.scope == "global")
    FOR constraint IN globalInputConstraints
        APPEND lines, "- " + constraint.description
    END FOR

    // 依赖关系约束
    IF LENGTH(dependencyGraph.edges) > 0 THEN
        APPEND lines, "- Field Dependencies:"
        FOR edge IN dependencyGraph.edges
            APPEND lines, "  - '" + edge.from + "' depends on '" + edge.to + "'"
        END FOR
    END IF

    RETURN JOIN(lines, "\n")
END FUNCTION

FUNCTION BuildSemanticSpecs(fields: List<ResolvedFieldNode>): String
    lines = []
    APPEND lines, "## Semantic Token Specifications"

    tokenFields = FILTER(fields, f -> f.resolved_value IS NOT NULL)
    FOR field IN tokenFields
        token = field.resolved_value
        APPEND lines, "### $" + field.semantic_token
        APPEND lines, "- Maps to field: '" + field.name + "'"
        APPEND lines, "- Type: " + token.value_type
        IF token.ontology_ref IS NOT NULL THEN
            APPEND lines, "- Ontology Reference: " + token.ontology_ref
        END IF
        IF token.examples IS NOT NULL THEN
            APPEND lines, "- Examples: " + JOIN(token.examples, ", ")
        END IF
    END FOR

    RETURN JOIN(lines, "\n")
END FUNCTION
```

---

### Step 4: 生成最终 Prompt（组装结构化输出）

**目标**：将所有模板段按优先级排序，组装为最终的结构化 Prompt 字符串，附加元数据头，确保 LLM 能精确理解任务要求。

**输入输出**：

| 属性 | 值 |
|------|-----|
| **输入** | `PromptTemplate`（来自 Step 3）+ `CompilationOptions`（编译选项） |
| **输出** | `FinalPrompt`（字符串形式的结构化 Prompt + 元数据） |
| **错误处理** | 段缺失时抛出 `IncompleteTemplateError` |

```pseudocode
FUNCTION GenerateFinalPrompt(
    template: PromptTemplate,
    options: CompilationOptions = DEFAULT_OPTIONS
): FinalPrompt

    // 4.1 定义段的组装顺序
    sectionOrder = options.section_order OR [
        "role_definition",
        "output_format",
        "semantic_specifications",
        "field_constraints",
        "global_constraints"
    ]

    // 4.2 构建元数据头
    headerLines = []
    APPEND headerLines, "============================================================"
    APPEND headerLines, "INTENT: " + template.intent_name
    APPEND headerLines, "GENERATED_BY: IntentSchemaCompiler/PromptCompiler v1.0"
    APPEND headerLines, "TIMESTAMP: " + NOW_ISO8601()
    APPEND headerLines, "SCHEMA_VERSION: " + options.schema_version
    APPEND headerLines, "STRICT_MODE: " + (options.strict ? "ON" : "OFF")
    APPEND headerLines, "============================================================"

    // 4.3 按序组装各段
    bodyLines = []
    FOR sectionName IN sectionOrder
        section = FIND(template.sections, s -> s.name == sectionName)
        IF section IS NULL THEN
            IF options.strict THEN
                THROW IncompleteTemplateError(
                    "Required section '" + sectionName + "' is missing"
                )
            ELSE
                CONTINUE  // 非严格模式跳过缺失段
            END IF
        END IF

        APPEND bodyLines, ""
        APPEND bodyLines, "--- " + UPPERCASE(REPLACE(sectionName, "_", " ")) + " ---"
        APPEND bodyLines, section.content
    END FOR

    // 4.4 附加输出指令（强制 JSON 输出）
    footerLines = []
    APPEND footerLines, ""
    APPEND footerLines, "--- OUTPUT INSTRUCTIONS ---"
    APPEND footerLines, "1. Output MUST be valid JSON."
    APPEND footerLines, "2. Do NOT include markdown code fences (```json)."
    APPEND footerLines, "3. Do NOT include any explanatory text outside the JSON."
    APPEND footerLines, "4. All required fields MUST be present and non-null."
    APPEND footerLines, "5. Enum fields MUST use one of the allowed values exactly."
    APPEND footerLines, "6. String values MUST NOT exceed specified max lengths."
    IF options.strict THEN
        APPEND footerLines, "7. STRICT MODE: Any deviation from schema will be rejected."
    END IF

    // 4.5 组装最终输出
    result = NEW FinalPrompt()
    result.content = JOIN(headerLines, "\n") +
                     JOIN(bodyLines, "\n") +
                     JOIN(footerLines, "\n")
    result.metadata = {
        "intent": template.intent_name,
        "sections_included": sectionOrder,
        "compilation_time": NOW_ISO8601(),
        "compiler_version": "1.0",
        "options": options
    }

    // 4.6 最终校验：Prompt 非空且包含关键标记
    ASSERT LENGTH(result.content) > 0
        THROW CompilationError("Generated prompt is empty")
    ASSERT CONTAINS(result.content, "Output MUST be valid JSON")
        THROW CompilationError("Missing JSON output instruction")

    RETURN result
END FUNCTION
```

---

## 3. 完整示例：alert_generation 意图编译

本示例演示从 `alert_generation` 意图 Schema 到最终 Prompt 的完整四步编译过程。

### 3.1 输入：alert_generation Intent Schema

```yaml
intent: alert_generation
version: "1.0"
description: "Generate a system alert with severity, message, and recommended action"
fields:
  - name: alert_id
    type: string
    required: true
    description: "Unique identifier for the alert"
    validation:
      - type: regex
        rule: "^ALERT-[A-Z0-9]{8}$"
        severity: error

  - name: severity
    type: enum
    required: true
    semantic: "$SEVERITY_LEVEL"
    description: "Alert severity classification"

  - name: timestamp
    type: string
    required: true
    description: "ISO 8601 timestamp when the alert was generated"
    validation:
      - type: regex
        rule: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z$"
        severity: error

  - name: message
    type: string
    required: true
    description: "Human-readable alert description"
    validation:
      - type: length
        rule: { min: 10, max: 500 }
        severity: error

  - name: source_component
    type: string
    required: true
    description: "System component that triggered the alert"

  - name: recommended_action
    type: string
    required: false
    description: "Suggested remediation steps"
    default: "Contact system administrator for investigation."

  - name: metadata
    type: object
    required: false
    fields:
      - name: tags
        type: array
        item_schema:
          type: string
      - name: correlation_id
        type: string
        description: "ID for correlating related alerts"

constraints:
  - type: dependency
    field: recommended_action
    rule: "required when severity == 'critical'"
    severity: error
  - type: range
    field: message
    rule: { min_length: 10, max_length: 500 }
    severity: error

metadata:
  author: "ops-team"
  domain: "system-monitoring"
```

### 3.2 语义令牌词典（Token Dictionary）

```yaml
SEVERITY_LEVEL:
  value_type: "enum"
  description: "Standardized severity levels for system alerts"
  ontology_ref: "ITIL.AlertSeverity"
  allowed_values:
    - critical    # System outage or data loss imminent
    - high        # Significant impact, immediate attention needed
    - medium      # Moderate impact, should be addressed soon
    - low         # Minor issue, can be addressed during maintenance
    - info        # Informational, no action required
  format_pattern: "lowercase string"
  examples:
    - "critical"
    - "high"
    - "medium"
```

### 3.3 运行时输入约束

```yaml
input_constraints:
  - field: severity
    scope: field
    rule_description: "Severity must not be 'info' for production alerts"
    condition: "severity != 'info'"
  - field: message
    scope: field
    rule_description: "Message must include affected service name"
    condition: "CONTAINS(message, service_name)"
  - scope: global
    rule_description: "Alert timestamp must be within last 24 hours"
    condition: "timestamp >= NOW() - 24h"
```

### 3.4 编译过程追踪

#### Step 1: Schema AST 输出

```json
{
  "intent_name": "alert_generation",
  "version": "1.0",
  "description": "Generate a system alert with severity, message, and recommended action",
  "fields": [
    { "name": "alert_id", "type": "string", "required": true, "semantic_token": null },
    { "name": "severity", "type": "enum", "required": true, "semantic_token": "$SEVERITY_LEVEL" },
    { "name": "timestamp", "type": "string", "required": true, "semantic_token": null },
    { "name": "message", "type": "string", "required": true, "semantic_token": null },
    { "name": "source_component", "type": "string", "required": true, "semantic_token": null },
    { "name": "recommended_action", "type": "string", "required": false, "semantic_token": null },
    { "name": "metadata", "type": "object", "required": false, "semantic_token": null,
      "fields": [
        { "name": "tags", "type": "array", "item_schema": { "type": "string" } },
        { "name": "correlation_id", "type": "string" }
      ]
    }
  ],
  "constraints": [
    { "type": "dependency", "target_field": "recommended_action",
      "rule": "required when severity == 'critical'", "severity": "error" }
  ],
  "semantic_refs": ["$SEVERITY_LEVEL"]
}
```

#### Step 2: 令牌解析后

```json
{
  "fields": [
    // ... other fields unchanged ...
    {
      "name": "severity",
      "type": "enum",
      "required": true,
      "semantic_token": "$SEVERITY_LEVEL",
      "resolved_value": {
        "value_type": "enum",
        "description": "Standardized severity levels for system alerts",
        "ontology_ref": "ITIL.AlertSeverity",
        "allowed_values": ["critical", "high", "medium", "low", "info"],
        "format_pattern": "lowercase string",
        "examples": ["critical", "high", "medium"]
      }
    }
    // ...
  ]
}
```

#### Step 3: Prompt 模板各段

| 段名称 | 生成内容摘要 |
|--------|-------------|
| `role_definition` | "You are a system alert generator. Your task is to generate a system alert with severity, message, and recommended action following the specified schema exactly." |
| `output_format` | JSON Schema 描述，包含 7 个顶级字段和 metadata 子结构 |
| `field_constraints` | 每个字段的类型、必填性、约束规则逐字段列出 |
| `global_constraints` | recommended_action 在 severity=critical 时必须存在；timestamp 需在 24h 内 |
| `semantic_specifications` | `$SEVERITY_LEVEL` 令牌展开为 5 个允许取值及其定义 |

#### Step 4: 最终 Prompt（节选）

```text
============================================================
INTENT: alert_generation
GENERATED_BY: IntentSchemaCompiler/PromptCompiler v1.0
TIMESTAMP: 2024-01-15T08:30:00Z
SCHEMA_VERSION: 1.0
STRICT_MODE: ON
============================================================

--- ROLE DEFINITION ---
You are a system alert generator. Generate a system alert
following the specified schema exactly.

--- OUTPUT FORMAT ---
Output a JSON object with the following structure:
{
  "alert_id": "string (required, format: ^ALERT-[A-Z0-9]{8}$)",
  "severity": "enum (required, allowed: critical|high|medium|low|info)",
  "timestamp": "string (required, ISO 8601 format)",
  "message": "string (required, 10-500 chars)",
  "source_component": "string (required)",
  "recommended_action": "string (optional, default: 'Contact system...')",
  "metadata": {
    "tags": ["string"],
    "correlation_id": "string"
  }
}

--- SEMANTIC SPECIFICATIONS ---
### $SEVERITY_LEVEL
- Maps to field: 'severity'
- Type: enum
- Ontology Reference: ITIL.AlertSeverity
- Allowed Values: critical, high, medium, low, info
- Examples: critical, high, medium

--- FIELD CONSTRAINTS ---
## Field: 'severity'
- Type: enum
- Required: YES
- Description: Standardized severity levels for system alerts
- Semantic Definition:
  - Canonical Type: enum
  - Allowed Values: critical, high, medium, low, info
- Runtime Constraints:
  - Severity must not be 'info' for production alerts

## Field: 'message'
- Type: string
- Required: YES
- Runtime Constraints:
  - Message must include affected service name
- Validation Rules:
  - Length must be between 10 and 500 [severity: error]

[... remaining fields ...]

--- GLOBAL CONSTRAINTS ---
- dependency: required when severity == 'critical' [applies to: recommended_action]
- Alert timestamp must be within last 24 hours

--- OUTPUT INSTRUCTIONS ---
1. Output MUST be valid JSON.
2. Do NOT include markdown code fences.
3. Do NOT include any explanatory text outside the JSON.
4. All required fields MUST be present and non-null.
5. Enum fields MUST use one of the allowed values exactly.
6. STRICT MODE: Any deviation from schema will be rejected.
```

---

## 4. 编译错误码表

| 错误码 | 名称 | 触发条件 | 处理建议 |
|--------|------|----------|----------|
| `E1001` | `SchemaLoadError` | Schema 文件缺失或格式非法 | 检查文件路径和 YAML/JSON 语法 |
| `E1002` | `UnknownTokenError` | 语义令牌在词典中未定义 | 补充 TokenDictionary 或修正令牌引用 |
| `E1003` | `TokenTypeMismatchError` | 字段类型与令牌类型不兼容 | 调整字段类型或选用兼容的令牌 |
| `E1004` | `ConstraintConflictError` | 多条约束条件互相矛盾 | 检查并消除约束冲突 |
| `E1005` | `IncompleteTemplateError` | 严格模式下缺失必要模板段 | 检查模板定义完整性 |
| `E1006` | `CompilationError` | 最终 Prompt 校验失败 | 查看详细日志定位失败原因 |

---

## 5. 扩展点

| 扩展点 | 说明 |
|--------|------|
| `Custom Token Resolvers` | 支持注册自定义语义令牌解析器 |
| `Template Engine Plugins` | 支持 Mustache / Jinja2 等模板引擎 |
| `Multi-language Output` | 通过 i18n 配置生成多语言 Prompt |
| `Section Reorder` | 通过 `CompilationOptions.section_order` 自定义段顺序 |
| `Conditional Sections` | 支持基于条件动态包含/排除模板段 |
