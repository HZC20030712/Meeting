#!/bin/bash

# --- 颜色定义 ---
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# --- 默认配置 ---
START_BACKEND=true
START_FRONTEND=true
DEBUG_MODE=false
PORT=8000

# --- 帮助信息 ---
show_help() {
    echo "使用方法: ./dev.sh [选项]"
    echo ""
    echo "选项:"
    echo "  all          同时启动前端和后端 (默认)"
    echo "  backend      仅启动后端"
    echo "  frontend     仅启动前端"
    echo "  --debug      开启后端调试模式 (ASR_DEBUG=1)"
    echo "  --port PORT  指定后端端口 (默认 8000)"
    echo "  --help       显示帮助信息"
    echo ""
    echo "示例:"
    echo "  ./dev.sh backend --debug"
    echo "  ./dev.sh frontend"
}

# --- 解析参数 ---
while [[ $# -gt 0 ]]; do
    case $1 in
        all)
            START_BACKEND=true
            START_FRONTEND=true
            shift
            ;;
        backend)
            START_BACKEND=true
            START_FRONTEND=false
            shift
            ;;
        frontend)
            START_BACKEND=false
            START_FRONTEND=true
            shift
            ;;
        --debug)
            DEBUG_MODE=true
            shift
            ;;
        --port)
            PORT="$2"
            shift 2
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}未知选项: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# --- 清理函数 ---
cleanup() {
    echo -e "\n${YELLOW}正在停止服务...${NC}"
    # 杀掉后台进程组
    kill $(jobs -p) 2>/dev/null
    exit
}

# 捕获退出信号
trap cleanup SIGINT SIGTERM

# --- 启动后端 ---
start_backend() {
    echo -e "${BLUE}[Backend]${NC} 正在启动后端服务..."
    cd backend
    
    # 检查虚拟环境
    if [ ! -d ".venv" ]; then
        echo -e "${YELLOW}[Backend] 虚拟环境未找到，正在创建并安装依赖...${NC}"
        uv venv
        source .venv/bin/activate
        uv pip install -r requirements.txt
    fi
    
    # 设置环境变量
    export PORT=$PORT
    if [ "$DEBUG_MODE" = true ]; then
        export ASR_DEBUG=1
        echo -e "${YELLOW}[Backend] 调试模式已开启 (ASR_DEBUG=1)${NC}"
    fi
    
    # 运行
    uv run uvicorn main:app --reload --host 0.0.0.0 --port $PORT &
    BACKEND_PID=$!
    cd ..
}

# --- 启动前端 ---
start_frontend() {
    echo -e "${GREEN}[Frontend]${NC} 正在启动前端服务..."
    
    # 检查 node_modules
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}[Frontend] node_modules 未找到，正在安装依赖...${NC}"
        npm install
    fi
    
    # 运行
    npm run dev &
    FRONTEND_PID=$!
}

# --- 执行启动 ---
echo -e "${BLUE}=== Meeting AI 开发环境启动脚本 ===${NC}"

if [ "$START_BACKEND" = true ]; then
    start_backend
fi

if [ "$START_FRONTEND" = true ]; then
    start_frontend
fi

echo -e "${YELLOW}服务已启动。按 Ctrl+C 停止所有服务。${NC}"

# 等待后台进程
wait
