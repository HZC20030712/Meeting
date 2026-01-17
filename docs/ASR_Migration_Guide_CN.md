# ASR 全栈迁移方案文档 (Qwen3 + 阿里云 OSS)

## 1. 架构变更概述

本次更新将原有的“火山引擎”方案完全替换为 **阿里云全栈方案**，实现了以下核心能力的升级：
- **存储层**: 使用阿里云 OSS (Object Storage Service) 存储录音文件，替代本地临时存储，支持长音频处理。
- **模型层**: 
  - 离线转写: `qwen3-asr-flash-filetrans` (支持说话人分离、情感识别、时间戳)。
  - 实时识别: `qwen3-asr-flash-realtime` (低延迟流式识别)。
- **监控层**: 引入 `loguru` 实现标准化的文件日志记录，便于生产环境调试。

## 2. 接口定义

### 2.1 录音文件转写接口 (离线)

**接口地址**: `POST /api/asr/file`
**Content-Type**: `multipart/form-data`

| 参数名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `file` | File | 音频文件 (支持 wav, mp3, m4a, ogg 等) |

**响应示例**:
```json
{
  "task_id": "35804366-...",
  "status": "succeeded",
  "segments": [
    {
      "id": "seg-0",
      "type": "user",
      "content": "大家好，今天我们来讨论一下项目进度。",
      "startTime": "00:05",
      "endTime": "00:12",
      "speaker": "Speaker 0",
      "emotion": "HAPPY"
    }
  ],
  "raw": { ... } // 原始 DashScope 响应
}
```

**处理流程**:
1. 接收前端上传的文件。
2. 后端自动上传至阿里云 OSS Bucket (`meeting0117`)。
3. 获取 OSS 签名 URL (Signed URL)。
4. 提交 DashScope 异步任务并等待完成。
5. 格式化输出结果。

### 2.2 实时语音识别接口 (WebSocket)

**接口地址**: `ws://localhost:8000/ws/asr`

**协议说明**:
- **发送**: 二进制音频流 (PCM S16LE, 16000Hz)。
- **接收**: JSON 格式识别结果。
  ```json
  {
    "type": "transcript",
    "text": "正在识别的内容...",
    "is_final": false,
    "speaker": null
  }
  ```

## 3. 配置指南

请确保项目根目录下的 `.env` 文件包含以下配置：

```ini
# --- 阿里云 OSS 配置 ---
ALIYUN_ACCESS_KEY_ID="<your_ak>"
ALIYUN_ACCESS_KEY_SECRET="<your_sk>"
ALIYUN_OSS_BUCKET="meeting0117"
ALIYUN_OSS_ENDPOINT="oss-cn-beijing.aliyuncs.com"

# --- DashScope 配置 ---
DASHSCOPE_API_KEY="<your_dashscope_key>"
```

## 4. 调试与日志

后端日志已启用文件记录，位置在 `backend/logs/server.log`。
日志包含：
- OSS 上传状态与签名 URL 生成。
- DashScope 任务提交 ID 与状态。
- 实时识别的 WebSocket 连接事件与错误堆栈。

查看日志示例:
```bash
tail -f backend/logs/server.log
```
