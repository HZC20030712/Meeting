# 会议记录系统开发与调试文档

本文档记录了近期系统的功能升级、核心架构变动以及在实现“说话人分离”过程中遇到的技术挑战与解决方案。

## 1. 新增功能

### 1.1 文件哈希去重 (Deduplication)
- **原理**: 使用 MD5 对上传文件内容计算哈希。
- **本地存储**: 相同内容的文件仅保存一份，文件名格式为 `{hash}.ext`。
- **OSS 存储**: 上传前检查 OSS 中是否存在相同哈希的对象，若存在则跳过上传，直接生成签名 URL。
- **效益**: 节省本地/云端存储空间，大幅缩短重复文件的转写等待时间。

### 1.2 会议记录持久化 (Persistence)
- **技术栈**: SQLite + SQLAlchemy (Python ORM)。
- **数据表**:
  - `meetings`: 存储会议元数据（标题、日期、时长、OSS URL 等）。
  - `segments`: 存储转写详情（说话人、时间戳、内容、情感标签）。
- **前端联动**: 页面加载时自动从后端 `/api/meetings` 获取历史记录，点击卡片按需加载转写详情。

### 1.3 核心转写模型切换 (FunASR)
- **变更**: 从 Qwen3-ASR 切换为 **FunASR (Paraformer)**。
- **优势**: FunASR 在会议场景下的说话人分离 (Diarization) 更加稳定，且 SDK 支持度更高。

---

## 2. 调试过程 (Debug Log)

### 问题：说话人显示为 `Speaker ?` 或 `unknown_speaker_default`
在开发过程中，转写结果始终无法正确区分说话人，导致 UI 显示异常。

#### 阶段 1：字段名不匹配
- **现象**: 后端解析不到 `speaker_id`。
- **发现**: 不同模型返回的字段可能在 `speaker_id`、`speaker`、`spk_id` 之间切换。
- **修复**: 增加了多字段兼容解析，并引入 `if val is not None` 显式判断（防止 `speaker_id=0` 被 Python 误判为 False）。

#### 阶段 2：SDK 参数传递位置错误
- **发现**: DashScope Python SDK 的 `Transcription.async_call` 要求 `diarization_enabled` 必须作为 **顶层参数** 传入，而非放在 `parameters` 字典内。
- **修复**: 调整了 SDK 调用方式。

#### 阶段 3：音频声道冲突 (核心突破)
- **现象**: 即便开启了开关，返回结果中依然没有 `speaker_id`。
- **根因**: FunASR 的说话人分离算法仅支持 **单声道 (Mono)**。用户上传的 MP4/MP3 往往是双声道 (Stereo)，导致算法静默失效。
- **修复**: 后端引入 `ffmpeg` 预处理流程。在文件上传后，自动将其抽离并转换为 `16k 单声道 WAV` 格式，再送往转写。

---

## 3. 开发环境配置
- **FFmpeg**: 必须安装在系统路径中，用于音频声道处理。
- **环境变量**: 需在 `.env` 中配置 `ALIYUN_ACCESS_KEY_ID` 等 OSS 相关信息。
- **ASR_DEBUG**: 设置 `ASR_DEBUG=1` 可将详细的转写 JSON URL 及统计信息输出到 `backend/logs/debug_asr_urls.log`。

---

## 4. 后续优化建议
- **说话人聚类优化**: 目前仅依赖 ASR 返回的 ID，未来可引入声纹识别进行跨会议的说话人对齐。
- **分片上传**: 对于超过 50MB 的大音频，建议前端实现分片上传以提高稳定性。
