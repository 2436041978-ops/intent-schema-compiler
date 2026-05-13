# 组织架构上下文

## 本仓库在组织中的位置

本仓库是 Schema-As-Code 约束编译框架的 **协议层载体**，服务于以下组织轨道：

| 轨道 | 消费本仓库的哪些内容 | 产出什么 |
|---|---|---|
| 设计轨道 | `kernel/` 语义定义 | 设计意图 YAML |
| 治理轨道（意图治理） | 全仓库 | 维护协议版本、编译约束规则 |
| AI/算法轨道 | `compilers/` 编译输出 | 带约束的 Prompt 模板 |
| 前端轨道 | `kernel/semantic-tokens.yaml` | 语义令牌绑定的组件 |
| QA 轨道 | `tests/` 场景测试 + `meta-validation/` 自反检查 | 语义合规测试报告 |

## 渐进采纳路径

1. **协议对齐（0-3 个月）**：设计轨道产出第一份 `intent.yaml`，AI 轨道在 Prompt 中预留约束占位符
2. **编译闭环（3-6 个月）**：治理轨道编译第一份约束规则，试点场景验证语义漂移拦截
3. **规模化治理（6-12 个月）**：全仓库意图库覆盖核心业务，校验引擎接入 CI/CD

## 工具中立声明

本仓库的协议层（YAML/JSON/Markdown）不绑定任何特定工具或技术栈：

- 设计平台：Figma/Sketch/即时设计均可，只要产出标准 YAML
- 前端技术栈：React/Vue/Angular 均可，只要消费语义令牌接口
- AI 平台：OpenAI/Claude/自研模型均可，只要支持 Prompt 约束注入
- CI/CD：GitHub Actions/GitLab CI/Jenkins 均可，只要调用标准校验脚本
