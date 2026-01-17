# Meeting AI - AI 会议纪要助手

Meeting AI 是一个智能化的会议管理与分析平台，集成了实时语音转写（ASR）、AI 智能对话和会议洞察功能。旨在帮助团队高效记录、回顾和挖掘会议价值。

## ✨ 主要功能

- **实时语音转写**: 基于阿里 DashScope (通义听悟) 的实时语音识别，支持流式输出。
- **智能 AI 助手**: 集成 Gemini-3-Flash 模型，支持对会议内容的实时问答与互动。
- **智能建议**: 在对话静默时，AI 自动根据上下文生成能够延续话题的开放式问题。
- **会议管理**: 
  - 看板视图：直观管理近期会议。
  - 文件夹归档：按时间维度的会议沉淀。
  - 录音回溯：支持录音文件的保存与回放（开发中）。
- **现代化 UI**: 基于 React 19 和 Tailwind CSS 构建的响应式界面，支持深色/浅色模式适配（当前默认为浅色）。

## 🛠 技术栈

### 前端 (Frontend)
- **框架**: React 19, Vite
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **状态管理**: React Hooks (useState, useEffect, useReducer)
- **图标**: FontAwesome (via CDN/Component)

### 后端 (Backend)
- **框架**: FastAPI (Python)
- **服务器**: Uvicorn
- **WebSocket**: 用于实时音频流传输和 ASR 结果推送
- **AI 服务**:
  - ASR: Alibaba Cloud DashScope (FunASR Realtime)
  - LLM: Google Gemini-3-Flash (via OpenAI Compatible API)

## 🚀 快速开始

### 前置要求
- **Node.js**: v18 或更高版本
- **Python**: 3.10 或更高版本
- **API Keys**:
  - DashScope API Key (用于 ASR)
  - OpenAI/Gemini API Key (用于 AI 对话)

### 1. 后端设置

进入 `backend` 目录并使用 `uv` 管理环境：

```bash
cd backend

# 创建虚拟环境
uv venv

# 激活虚拟环境 (可选，uv run 会自动使用)
source .venv/bin/activate

# 安装依赖
uv pip install -r requirements.txt
```

启动后端服务：

```bash
# 在 backend 目录下
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
服务将在 `http://localhost:8000` 启动，WebSocket 地址为 `ws://localhost:8000/ws/asr`。

### 2. 前端设置

在项目根目录下安装 Node.js 依赖：

```bash
npm install
```

启动前端开发服务器：

```bash
npm run dev
```
访问终端输出的本地地址 (通常为 `http://localhost:5173`)。

## ⚙️ 环境变量配置

为了安全起见，建议将 API Key 移至环境变量。
(当前代码中 API Key 可能硬编码在 `backend/main.py` 中，建议修改为从环境变量读取)

**backend/.env** (需新建):
```env
DASHSCOPE_API_KEY=your_dashscope_key
OPENAI_API_KEY=your_openai_key
OPENAI_BASE_URL=https://aihubmix.com/v1
```

## 📁 目录结构

```
Meeting/
├── backend/                # Python FastAPI 后端
│   ├── main.py            # 后端主入口 (ASR & Chat API)
│   └── requirements.txt   # Python 依赖
├── components/            # React 组件
│   ├── AIChatBar.tsx      # AI 对话栏
│   ├── MeetingList.tsx    # 会议列表
│   └── ...
├── hooks/                 # Custom React Hooks
│   └── useRecording.ts    # 录音逻辑封装
├── App.tsx                # 主应用组件
├── types.ts               # TypeScript 类型定义
└── vite.config.ts         # Vite 配置
```

## 📝 注意事项

- 确保后端服务先于前端启动，否则 WebSocket 连接会失败。
- 浏览器需授予麦克风权限以使用录音功能。
