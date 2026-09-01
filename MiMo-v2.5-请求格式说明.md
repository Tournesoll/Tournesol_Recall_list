# MiMo v2.5 请求格式说明

本文用于 Recall Lite 本地应用接入 Xiaomi MiMo v2.5。接口采用兼容 OpenAI Responses API 的格式。

## 1. 基础配置

```ts
const MIMO_BASE_URL = "https://api.xiaomimimo.com/v1";
const MIMO_MODEL = "mimo-v2.5";
const MIMO_API_KEY = "在本机配置，不要写入 Git";
```

请求地址：

```text
POST https://api.xiaomimimo.com/v1/responses
```

请求头：

```http
Authorization: Bearer <MIMO_API_KEY>
Content-Type: application/json
```

API Key 只放在本地配置或本地环境变量中，例如 `VITE_MIMO_API_KEY`。禁止写入源码、示例、日志、截图、PR 或群文件。该 Key 已在聊天中明文出现，正式使用前建议重新生成一枚新 Key。

## 2. 文本请求

```ts
const response = await fetch(`${MIMO_BASE_URL}/responses`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${MIMO_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: MIMO_MODEL,
    input: [
      {
        role: "system",
        content: "你是学习软件助手，只回答当前题目和学习内容相关的问题。",
      },
      {
        role: "user",
        content: "请将下面内容整理为 Recall Lite 卡片：\n……",
      },
    ],
    temperature: 0.2,
  }),
});

const data = await response.json();
```

Responses 返回内容通常位于 `output` 数组中的文本内容。接入层应统一封装一个 `extractResponseText(data)`，兼容字符串、`output_text` 以及 `output[].content[].text` 等返回形态，不要让页面直接依赖供应商原始结构。

## 3. 图片多模态请求

图片建议先转成 Data URL，再作为 `input_image` 发送：

```ts
const body = {
  model: MIMO_MODEL,
  input: [
    {
      role: "user",
      content: [
        { type: "input_text", text: "识别图片中的知识点，并按约定 JSON 输出。" },
        { type: "input_image", image_url: imageDataUrl },
      ],
    },
  ],
  temperature: 0.2,
};
```

图片大小、格式和 Data URL 支持范围以实际接口返回为准。失败时要向用户显示可理解的错误，不要展示 API Key 或完整请求头。

## 4. AI 导入的 JSON 约定

AI 导入前由用户选择卡片类型和是否生成“题目解析”。提示词中必须明确要求只输出 JSON，不要输出 Markdown 代码围栏或额外解释：

```json
{
  "version": 1,
  "items": [
    {
      "type": "recall",
      "question": "问题",
      "answer": "答案",
      "explanation": "题目解析（未选择时省略）"
    }
  ]
}
```

允许的 `type`：

- `recall`：`question` + `answer`
- `cloze`：`content`
- `choice`：`question` + `options` + `correctIndex`

客户端必须使用项目中的 Schema 校验结果。解析失败时，将错误原因和原始 JSON 交给 AI 自动修复，最多重试 3 次；3 次仍失败则保留原始结果供用户查看，不得静默导入脏数据。

## 5. 背诵中的临时答疑

用户揭晓当前卡片答案后才显示“问 AI”。每次提问使用当前卡片上下文：

```ts
const body = {
  model: MIMO_MODEL,
  input: [
    {
      role: "system",
      content: "只回答当前题目相关内容；无关问题请礼貌拒绝。回答简洁、可用于学习。",
    },
    {
      role: "user",
      content: `当前题目：${question}\n当前答案：${answer}\n用户问题：${userQuestion}`,
    },
  ],
  temperature: 0.2,
};
```

答疑内容不保存、不写入 IndexedDB。切换到下一张卡片时清空上下文；不提供 AI 生成笔记功能。

## 6. 记录页 AI 数据分析

记录页只发送聚合后的近期学习统计，例如近 7 天或 30 天的复习次数、各评价数量、待复习数量和知识库分布。不要发送完整题目、答案、个人隐私或 API Key。分析结果仅在当前页面展示，不保存。

## 7. 开发与测试要求

1. AI 请求统一放在 `src/features/ai/**`，页面只调用封装后的函数。
2. 所有请求都要处理 HTTP 非 2xx、超时、网络断开、空响应和 JSON 格式错误。
3. 开发测试使用假 Key 或本地环境变量；提交前检查 `git diff`，确认没有密钥、真实学习资料和调试日志。
4. 至少验证文本导入、图片导入、JSON 修复 3 次上限、答疑切卡清空、接口失败提示和移动端显示。
