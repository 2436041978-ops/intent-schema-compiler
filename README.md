# intent-schema-compiler
Schema-As-Code 约束编译框架 —— 意图的形式化契约注入与概率性输出确定性治理
# Intent Schema Compiler

Schema-As-Code 约束编译框架 —— 意图的形式化契约注入与概率性输出确定性治理。

&gt; 在 AI 场景不是做 Prompt Engineering，而是做意图的形式化契约注入——把设计意图的不可变边界编译进 LLM 的输入约束和输出校验，让概率性输出被锁定在 Schema 定义的确定性范围内。

## 架构定位

本仓库是 Schema-As-Code 约束编译框架的 **v0.1.0 架构协议发布**（最小可行协议）。

- 如果您关注"这套协议如何在组织中落地"，请参阅 `docs/organizational-context.md`
- 如果您关注"编译层如何将语义转化为约束"，请参阅 `compilers/` 目录下的思维链文档

## 三层架构（本仓库的目录映射）

| 层级 | 目录 | 职责 | 对应组织角色 |
|---|---|---|---|
| **语义层** | `kernel/` | 意图契约 + 语义令牌 | 设计师 + 产品经理 |
| **治理层** | `rules/` + `meta-validation/` | 约束规则 + 自反性检查 | 治理负责人（意图治理轨道） |
| **执行层** | `compilers/` + `patterns/` + `tests/` | 编译模板 + 模式卡片 + 场景测试 | 工程师 + AI 团队 + QA |

## 核心文件说明

| 文件 | 层级 | 说明 |
|---|---|---|
| `kernel/intent-schema.json` | 语义层 | 意图契约元定义（JSON Schema Draft 7） |
| `kernel/semantic-tokens.yaml` | 语义层 | 语义令牌注册表（7 个核心令牌） |
| `rules/input-constraints/prompt-boundary.yaml` | 治理层 | Prompt 输入约束规则（含安全护栏） |
| `rules/output-constraints/response-schema.yaml` | 治理层 | 输出校验 Schema + 四层推演规范 |
| `meta-validation/schema-meta-checks.yaml` | 治理层 | 自反性检查——验证协议自身完备性 |
| `compilers/prompt-compiler.md` | 执行层 | Prompt 编译器思维链（伪代码） |
| `compilers/validation-compiler.md` | 执行层 | 校验编译器思维链（四层推演） |
| `compilers/templates/prompt-compiler-template.yaml` | 执行层 | Prompt 编译模板规范 |
| `patterns/ai-interaction/alert-card.yaml` | 执行层 | 告警卡片交互模式（P0/P1/P2） |
| `tests/scenarios/p0-alert-generation.yaml` | 执行层 | P0 场景测试用例（3 个边界 case） |
| `tests/meta/schema-completeness.yaml` | 执行层 | 协议完备性自反测试 |
| `docs/organizational-context.md` | — | 组织架构上下文与采纳路径 |

## 零代码快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/你的用户名/intent-schema-compiler.git

# 2. 查看意图契约示例
cat kernel/intent-schema.json

# 3. 查看语义令牌注册表
cat kernel/semantic-tokens.yaml

# 4. 查看约束规则
cat rules/input-constraints/prompt-boundary.yaml

# 5. 查看编译思维链
cat compilers/prompt-compiler.md
