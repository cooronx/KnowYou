# Project Collaboration Rules

## Git Commits

- 使用 Conventional Commits 格式，类型前缀使用标准英文，描述部分使用简短中文，例如 `feat: 新增房间流程`、`fix: 修复回合提交`、`docs: 更新项目文档`。
- 常用类型包括 `feat`、`fix`、`docs`、`refactor`、`test`、`chore`；描述应直接说明改动，整行建议不超过 50 个字符。
- After completing a small feature or fix that compiles successfully, create a separate commit. Do not accumulate unrelated changes into one large commit.
- Before committing, inspect `git status` and `git diff`. Commit only changes made for the current task; do not overwrite or include unrelated user changes.
- Do not create commits without meaningful changes. Keep documentation, configuration, and refactoring changes scoped clearly.

## KnowYou 技术栈

- 前后端分离：`backend/` 使用 Node.js + NestJS + TypeScript + Prisma + PostgreSQL，`web/` 使用 Vite + React + TypeScript + Tailwind CSS 和 shadcn/ui。
- 优先复用现有依赖和项目脚本，不为一次性需求增加新的库。
- 页面交互放在 `web/` 的 React 组件中，房间规则和状态转换集中在 `backend/` 的服务端模块，避免客户端和服务端各维护一份规则。
- 两个应用各自安装依赖、类型检查与构建，命令都在各自目录下执行。

## 提交前检查

- 在改动所在应用目录运行检查：`backend/` 执行 `npm run typecheck`、`npm test`、`npm run build`；`web/` 执行 `npm run typecheck`、`npm run build`。
- 运行并修复本次改动引入的 TypeScript 类型错误。
- 涉及房间状态、回合推进或总结生成时必须运行后端测试并覆盖主流程。
- 发布或合并前确认两个应用的生产构建都成功。
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
