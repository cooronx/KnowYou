# Project Collaboration Rules

## Git Commits

- 使用 Conventional Commits 格式，类型前缀使用标准英文，描述部分使用简短中文，例如 `feat: 新增房间流程`、`fix: 修复回合提交`、`docs: 更新项目文档`。
- 常用类型包括 `feat`、`fix`、`docs`、`refactor`、`test`、`chore`；描述应直接说明改动，整行建议不超过 50 个字符。
- After completing a small feature or fix that compiles successfully, create a separate commit. Do not accumulate unrelated changes into one large commit.
- Before committing, inspect `git status` and `git diff`. Commit only changes made for the current task; do not overwrite or include unrelated user changes.
- Do not create commits without meaningful changes. Keep documentation, configuration, and refactoring changes scoped clearly.

## KnowYou 技术栈

- 运行时和全栈框架使用 Node.js + Next.js，前端使用 React、Tailwind CSS 和 shadcn/ui。
- 优先复用现有依赖和项目脚本，不为一次性需求增加新的库。
- 页面交互放在 React 组件中，房间规则和状态转换集中在服务端模块，避免客户端和服务端各维护一份规则。

## 提交前检查

- 先运行 `npm run lint`，修复本次改动引入的 ESLint 问题。
- 如果项目提供 `npm run typecheck`，运行并修复本次改动引入的 TypeScript 类型错误。
- 如果项目提供 `npm test`，运行相关测试；涉及房间状态、回合推进或总结生成时必须覆盖主流程。
- 发布或合并前运行 `npm run build`，确认 Next.js 生产构建成功。
- 如果某个脚本不存在或无法运行，在提交说明或最终结果中说明原因，不要伪造通过。
- 提交前再次检查 `git status` 和 `git diff`，确保只包含当前任务的改动。

## Tests

- Tests should cover real behavior and important edge cases; do not add mechanical tests for every file.
- Prefer a small number of focused, maintainable unit tests. Avoid testing the same implementation detail repeatedly.
- Add tests for public interfaces, core logic, and fixes that are likely to regress. Tests are not required for simple type changes or renames.

## Comments

- Add comments only for critical logic, non-obvious constraints, compatibility handling, or code that is easy to modify incorrectly.
- Comments should explain the reason, constraint, or intent rather than repeat what the code already says.
- Use common, clear technical terminology. Do not invent terms that cannot be understood outside the project.
- Keep comments synchronized with the code and remove comments that are no longer applicable.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
