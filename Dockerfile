# --- Stage 1: Build Frontend ---
FROM node:20-slim AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# --- Stage 2: Final Image ---
FROM modelscope-registry.cn-beijing.cr.aliyuncs.com/modelscope-repo/python:3.10

# 安装系统依赖 (ffmpeg)
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /home/user/app

# 复制后端依赖并安装
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# 复制前端构建产物
COPY --from=frontend-builder /app/dist ./dist

# 复制后端代码
COPY backend ./backend

# 暴露端口 (ModelScope 默认 7860)
EXPOSE 7860

# 设置环境变量 (可以在创空间界面覆盖)
ENV PYTHONUNBUFFERED=1

# 启动命令
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "7860"]
