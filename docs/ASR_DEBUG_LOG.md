# ASR 实时转写调试与修复记录

本文档记录了 2026-01-17 针对实时语音转写（Realtime ASR）失效问题的调试过程、核心发现及解决方案。

## 1. 问题现象
1. **模型报错**: 后端日志显示 `[QwenWS] Error: ... Model not found (qwen-omni-turbo-realtime-2025-03-26)!`。
2. **无文字输出**: 即使连接成功且前端在发送音频包，界面始终不显示转写文字。
3. **日志重复**: 前端和后端日志出现双份记录（例如同时创建两个会议 ID，两个 WebSocket 连接）。

## 2. 调试过程

### 2.1 数据流校验 (Frontend)
- **采样率确认**: 打印 `AudioContext.sampleRate`，确认为硬件支持的 `16000Hz`，排除重采样导致的音调偏移。
- **振幅监控**: 在 `onaudioprocess` 中计算 `Max amplitude`。观察到数值随说话起伏（0.1~0.3），确认麦克风采集与 PCM 编码正常。
- **发送频率**: 确认每秒约发送 4 帧（4096 采样点/帧），数据包稳定流向后端。

### 2.2 协议分析 (Backend)
- **连接测试**: 使用本地录音文件回放模拟前端流，确认后端接收逻辑。
- **原始事件监控**: 开启 `ASR_DEBUG=1`，捕获阿里云返回的原始 JSON 事件。
- **发现**: 
    - 阿里云并没有返回 `response.audio_transcript.delta`（OpenAI 标准名），而是返回了 `conversation.item.input_audio_transcription.text` 等自定义事件。
    - 服务端在连接关闭时返回了具体的 `close_status_code`，有助于定位认证或参数错误。

## 3. 核心发现与解决方案

### 3.1 模型加载机制 (Aliyun DashScope)
- **发现**: 阿里云的 OpenAI 兼容接口要求在 **WebSocket URL** 中通过查询参数指定模型，而不能仅在 `session.update` 中指定。
- **方案**: 修改连接地址为 `wss://.../realtime?model=qwen3-asr-flash-realtime`。

### 3.2 消息协议不匹配
- **发现**: 原有代码仅解析 `response.audio_transcript.*` 系列事件。阿里云实际返回的是 `conversation.item.input_audio_transcription.*` 结构。
- **方案**: 在 `on_message` 中补全事件映射，兼容处理 `delta`、`stash`、`transcript` 和 `text` 字段，确保增量和最终文本都能转发至前端。

### 3.3 React 严格模式导致的竞态条件
- **发现**: `React.StrictMode` 在开发环境下会触发两次挂载，导致 `startRecording` 被执行两次。由于 WebSocket 连接是异步的，传统的 `isRecording` 状态检查失效。
- **方案**: 
    - 在 `index.tsx` 中移除 `StrictMode`（可选，视开发需求而定）。
    - **核心修复**: 在 `useRecording.ts` 中引入同步锁 `initializingRef`，在函数入口处立即锁定，确保单次触发。

### 3.4 会话参数对齐
- **发现**: 阿里云要求 `session.update` 包含 `modalities: ["text"]` 和正确的 `turn_detection` 结构。
- **方案**: 按照阿里云最新示例更新了 `session.update` 的 Payload。

## 4. 修复文件清单
- [main.py](file:///Users/mucheng/Project/Meeting/backend/main.py): 修正 URL、完善事件解析逻辑、增加详细日志。
- [useRecording.ts](file:///Users/mucheng/Project/Meeting/hooks/useRecording.ts): 增加 `initializingRef` 防重入、添加音频流质量监控日志。
- [index.tsx](file:///Users/mucheng/Project/Meeting/index.tsx): 移除 `StrictMode` 消除双重渲染干扰。

## 5. 验证结果
经回放测试与真人实测，实时转写延迟约 500ms，支持自动分句与说话人状态同步，问题已彻底解决。
