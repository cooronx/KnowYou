# KnowYou 最小可玩版实现方案

本文把 [PRD.md](./PRD.md) 收敛成一个 AI 驱动的 MVP：两个浏览器打开网页，输入同一个房间码，由 AI 根据结构化故事大纲生成选择、读取双方文字推进剧情，并看到共同总结。

## 技术栈

- 运行时：Node.js
- 全栈框架：Next.js（App Router、Route Handlers）
- 前端：React
- 样式：Tailwind CSS
- UI 组件：shadcn/ui
- MVP 状态：Node.js 进程内存 `Map`
- AI：OpenAI Chat Completions API（兼容自定义 `base_url`）

页面、接口和状态逻辑放在同一个 Next.js 应用中，先不拆前后端服务，也不新增数据库或实时通信依赖。

## MVP 范围

保留：游客进入、固定一个房间、两名玩家、结构化故事大纲、AI 生成选择、双方文字行动、AI 推进剧情、AI 判断结尾、最终总结。

暂缓：知乎 OAuth、用户画像、故事 API、匹配算法、Redis/Postgres、SSE、Observer Agent、镜像提问、分享卡、多人房间和复杂内容审核。MVP 可先使用服务端内存状态；重启丢局是可接受的已知限制。

## AI 配置

在项目根目录创建 `.env.local`，由开发者自行填写：

```env
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=替换为你的_key
OPENAI_MODEL=gpt-4o-mini
```

服务端通过 Chat Completions 调用 AI；密钥只能在 Route Handler 中读取，禁止下发浏览器。AI 返回必须是 JSON，服务端校验字段，解析失败或超时要返回可继续游戏的错误状态。

## AI 故事流程

故事大纲只描述世界、冲突、结尾方向和两个角色，不预先写死回合：

```json
{"id":"lost-key","title":"走廊尽头的钥匙","premise":"断电前找到档案室钥匙并弄清留下纸条的人是谁。","setting":"旧教学楼","characters":[{"id":"a","name":"记录员","goal":"确认线索真伪","traits":"谨慎、善于观察"},{"id":"b","name":"行动员","goal":"在断电前打开档案室","traits":"果断、敢于冒险"}],"ending_hint":"真相被揭开且两人完成一次共同选择"}
```

每局开始，AI 读取大纲和开场内容，生成当前场景及 2 个价值取向不同的选择。每回合双方分别提交一个选择和最多 120 字的行动/台词；双方提交后，AI 读取大纲、历史、当前选择和两段文字，返回新的剧情文本、下一场景、下一组选项，以及 `isEnding`。当 `isEnding=true` 时进入总结，不再生成新回合。服务端保存 AI 输出和原始提交，客户端只展示服务端结果。

AI 输出格式固定为：

```json
{"narration":"...","scene":"...","choices":[{"id":"a","title":"..."},{"id":"b","title":"..."}],"isEnding":false,"endingReason":""}
```

最多允许 8 回合；达到上限时服务端强制要求 AI 收束，避免故事无限延长。AI 失败时保留当前回合并显示重试，不能丢失双方已提交文字；总结至少引用每回合的真实提交作为证据。

## 故事大纲的保存结构

故事保存为 JSON 文件或代码中的常量。MVP 只需要下面这些字段，后续接入知乎故事时再增加作者和来源字段。

```json
{
  "id": "test-lost-key",
  "title": "走廊尽头的钥匙",
  "summary": "两名夜班社团成员在旧教学楼寻找一把能打开档案室的钥匙。",
  "tags": ["校园", "悬疑", "合作"],
  "opening": "凌晨，旧教学楼即将断电。你们在门缝里发现一张纸条：钥匙在最不该出现的地方。",
  "characters": [
    {"id": "a", "name": "记录员", "description": "擅长观察细节，倾向先确认信息。"},
    {"id": "b", "name": "行动员", "description": "行动果断，愿意承担未知风险。"}
  ],
  "rounds": [
    {
      "id": 1,
      "prompt": "你们来到贴满旧海报的走廊，听见档案室方向有脚步声。",
      "choices": [
        {"id": "follow", "title": "跟上脚步", "consequence": "可能更快找到钥匙，但会暴露你们。"},
        {"id": "search", "title": "先搜海报墙", "consequence": "可能发现线索，但会错过脚步声。"}
      ]
    },
    {
      "id": 2,
      "prompt": "海报后找到钥匙，却听见楼下传来保安的手电光。",
      "choices": [
        {"id": "hide", "title": "藏起来等待", "consequence": "更安全，但断电时间正在接近。"},
        {"id": "run", "title": "立刻去档案室", "consequence": "可能赶在断电前打开门，但容易被发现。"}
      ]
    },
    {
      "id": 3,
      "prompt": "档案室打开，里面只有一台亮着的旧电脑和一封写给你们的信。",
      "choices": [
        {"id": "read", "title": "先读信", "consequence": "知道真相，但可能失去最后的离开时间。"},
        {"id": "copy", "title": "先复制文件", "consequence": "保住证据，但信的内容可能永远错过。"}
      ]
    }
  ]
}
```

保存原则：`choices` 是价值取向不同的分支；玩家提交的是 `choiceId` 和可选的短句；房间只保存当前回合及已提交记录，不复制整篇故事。

## 阶段 0：最小网页骨架

### 1. 具体目标

启动一个本地 Web 服务，访问首页即可开始体验。

### 2. 要实现的功能

- 首页显示产品名和“创建房间”“加入房间”。
- 创建房间后生成固定房间码，例如 `DEMO01`。
- 加入页输入房间码和昵称，不需要登录。
- 房间最多 2 人；第三人显示“房间已满”。
- 两个浏览器能看到相同的房间成员列表。

### 3. 注意事项

- 使用 Next.js App Router；交互页面使用 React Client Component。
- 使用 shadcn/ui 的 `Button`、`Card`、`Input`、`Badge`、`Textarea` 等组件，页面布局和间距用 Tailwind CSS 完成。
- 复用项目已有配置；没有既有应用时，用 `create-next-app` 初始化 TypeScript + Tailwind 项目，再添加 shadcn/ui。
- 房间状态先放进服务端内存 Map，避免为了 Demo 引入数据库。
- 每个玩家生成随机 `playerId`，仅存浏览器 `localStorage`。

## 阶段 1：房间等待与开局

### 1. 具体目标

两名玩家加入后，能明确看到“开始游戏”，并进入同一个故事。

### 2. 要实现的功能

- 房间状态：`waiting → playing → finished`。
- 第一名玩家创建房间并自动加入，第二名通过房间码加入。
- 两人到齐后展示固定故事标题、简介、角色卡和开场文本。
- 由任一玩家点击“开始”，或两人到齐后自动开始。

### 3. 注意事项

- 开始前禁止提交回合动作。
- 刷新页面应根据 `roomCode + playerId` 恢复当前房间。
- 房间码只在当前进程有效，页面明确提示“测试房间，重启后失效”。

## 阶段 2：三回合选择流程

### 1. 具体目标

两名玩家可以依次完成 3 个回合，并始终看到一致的剧情状态。

### 2. 要实现的功能

- 每回合显示 `prompt` 和两个选择分支。
- 玩家选择一个分支并可填写一句行动/台词（最多 120 字）。
- 提交后按钮变为“已提交”，不能重复提交。
- 两人都提交后，服务端生成回合结果：
  - 一致：采用共同选择；
  - 不一致：显示“你们选择了不同方向”，并按固定规则合并两条后果。
- 显示简单固定叙事模板，例如：
  - 一致：`你们都决定{选择}。两人的配合让线索继续显现。`
  - 分歧：`你选择了{A}，TA选择了{B}。争执片刻后，你们先{A}，再尝试{B}。`
- 进入下一回合，第三回合结束后进入总结页。

### 3. 注意事项

- 每回合由服务端调用 Chat Completions；API 不可用时允许重试，不用固定模板静默替代。
- 服务端是唯一状态来源，提交接口必须检查玩家属于房间、回合号正确、尚未提交。
- 轮询 `/api/rooms/:code`（例如每 1 秒）即可同步，先不做 SSE。
- 需要处理玩家中途刷新和重复请求；重复提交返回当前状态而不是报错页面。

## 阶段 3：生成总结

### 1. 具体目标

游戏结束后两名玩家看到同一份有证据的总结。

### 2. 要实现的功能

- 汇总 3 回合的选择和行动文字。
- 生成固定结构：
  - 三个共同点；
  - 两个差异点；
  - 一个互补点；
  - 三个下次可聊的话题。
- 每条总结引用回合证据，例如“第 1 回合，你们都选择了‘先搜海报墙’”。
- 提供“再来一局”按钮，清空当前玩家身份并回到首页。

### 3. 注意事项

- 总结由 AI 根据完整历史生成，但必须是确定结构并引用真实回合证据；超时可重试，不能阻塞房间状态恢复。
- 总结使用中立措辞，不做人格诊断、不评价是否适合、不暴露不存在的事实。
- 报告数据挂在房间状态上，两个客户端请求同一份结果。

## 阶段 4：最小验收与测试

### 1. 具体目标

开发者能用两个浏览器完整演示一局。

### 2. 要实现的功能

- 一条命令启动服务。
- 一个最小自动检查覆盖：创建房间、加入第二人、双方提交、进入下一回合、完成后生成报告。
- 手工演示路径：
  1. 浏览器 A 创建 `DEMO01`，昵称“甲”；
  2. 浏览器 B 加入 `DEMO01`，昵称“乙”；
  3. 两人完成 3 回合；
  4. 两边都看到同一份总结。

### 3. 注意事项

- 先验证主链路，再美化页面。
- 断网、登录、持久化、知乎接口均不作为本阶段阻塞项。
- 在页面显式标注“游客演示版 / 固定测试故事”。

## 推荐接口和最小状态

```text
POST /api/rooms                 创建房间并加入
POST /api/rooms/:code/join      加入房间
GET  /api/rooms/:code           获取房间快照
POST /api/rooms/:code/start     开始游戏
POST /api/rooms/:code/turn      提交本回合选择
```

## 推荐目录

```text
app/
  page.tsx                         # 首页：创建/加入
  room/[code]/page.tsx             # 房间和回合页面
  room/[code]/report/page.tsx      # 总结页面
  api/rooms/route.ts               # 创建房间
  api/rooms/[code]/join/route.ts   # 加入房间
  api/rooms/[code]/route.ts        # 房间快照
  api/rooms/[code]/start/route.ts  # 开始游戏
  api/rooms/[code]/turn/route.ts   # 提交选择
components/
  ui/                              # shadcn/ui 组件
  room/                            # 房间、回合、总结组件
lib/
  room-store.ts                    # 内存 Map 和状态转换
  story.ts                         # 固定测试故事
```

`room-store.ts` 是唯一修改房间状态的模块；React 组件只负责展示和调用 API，避免把游戏规则复制到浏览器端。

```ts
type Room = {
  code: string;
  state: 'waiting' | 'playing' | 'finished';
  playerIds: string[];
  players: Record<string, { name: string; role: 'a' | 'b' }>;
  round: number;
  submissions: Record<string, { choiceId: string; text: string }>;
  history: Array<{
    round: number;
    submissions: Record<string, { choiceId: string; text: string }>;
    narration: string;
  }>;
  report?: {
    common: string[];
    differences: string[];
    complement: string;
    topics: string[];
  };
};
```

## 完成标准

满足以下条件即可认为 MVP 完成：

- 未登录用户能打开网页并创建/加入唯一测试房间。
- 恰好两名玩家能看到相同故事和相同回合状态。
- 双方完成 3 回合后自动进入总结页。
- 总结至少包含具体回合证据，且两边内容一致。
- 服务重启后允许重新创建房间；不要求保留历史。

后续再把大纲替换为 PRD 的 Seed 表，把内存 Map 换成共享存储，把单次 Chat Completions 拆成 Director/Report Agent；这些都不应阻塞第一局可玩体验。
