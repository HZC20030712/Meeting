import React, { useState } from 'react';

interface Todo {
  id: string;
  content: string;
  completed: boolean;
  dueDate?: string;
  tag?: string;
}

const INITIAL_TODOS: Todo[] = [
  { id: '1', content: '整理 Q3 用户访谈数据', completed: false, tag: 'URGENT' },
  { id: '2', content: '更新产品路线图 PPT', completed: true, tag: 'DESIGN' },
  { id: '3', content: '回复 Alex 的面试反馈邮件', completed: false, dueDate: '今天 18:00' },
];

const TodoList: React.FC = () => {
  const [todos, setTodos] = useState<Todo[]>(INITIAL_TODOS);
  const [newTodo, setNewTodo] = useState('');

  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodo.trim()) return;
    
    const todo: Todo = {
      id: Date.now().toString(),
      content: newTodo,
      completed: false
    };
    
    setTodos([todo, ...todos]);
    setNewTodo('');
  };

  const toggleTodo = (id: string) => {
    setTodos(todos.map(t => 
      t.id === id ? { ...t, completed: !t.completed } : t
    ));
  };

  const deleteTodo = (id: string) => {
    setTodos(todos.filter(t => t.id !== id));
  };

  return (
    <div className="mt-12 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 px-1">
        <div className="w-1 h-4 rounded-full bg-gradient-to-b from-[#ff9a9e] to-[#fad0c4]"></div>
        <h2 className="text-[11px] font-black text-[#999999] uppercase tracking-[0.25em]">待办事项</h2>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Input Area */}
        <form onSubmit={handleAddTodo} className="border-b border-gray-100 p-2">
          <div className="relative flex items-center">
            <div className="absolute left-4 text-gray-300">
              <i className="fa-solid fa-plus"></i>
            </div>
            <input
              type="text"
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              placeholder="添加新的待办事项..."
              className="w-full pl-10 pr-4 py-3 bg-transparent text-sm font-bold text-gray-700 placeholder-gray-300 focus:outline-none"
            />
          </div>
        </form>

        {/* List */}
        <div className="divide-y divide-gray-50">
          {todos.map((todo) => (
            <div 
              key={todo.id}
              className={`group flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors ${todo.completed ? 'bg-gray-50/50' : ''}`}
            >
              {/* Checkbox */}
              <button
                onClick={() => toggleTodo(todo.id)}
                className={`
                  flex-shrink-0 w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center
                  ${todo.completed 
                    ? 'bg-[#33a3dc] border-[#33a3dc]' 
                    : 'border-gray-200 hover:border-[#33a3dc] bg-white'}
                `}
              >
                {todo.completed && <i className="fa-solid fa-check text-white text-[10px]"></i>}
              </button>

              {/* Content */}
              <div className="flex-1 min-w-0 flex items-center gap-3">
                <span className={`text-sm font-bold truncate transition-all ${todo.completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                  {todo.content}
                </span>
                
                {todo.tag && (
                  <span className={`
                    text-[9px] font-black uppercase px-1.5 py-0.5 rounded
                    ${todo.tag === 'URGENT' ? 'bg-red-50 text-red-400' : 'bg-purple-50 text-purple-400'}
                  `}>
                    {todo.tag}
                  </span>
                )}
                
                {todo.dueDate && (
                  <div className="flex items-center gap-1 text-gray-300">
                    <i className="fa-regular fa-clock text-[10px]"></i>
                    <span className="text-[10px] font-bold">{todo.dueDate}</span>
                  </div>
                )}
              </div>

              {/* Delete Action */}
              <button 
                onClick={() => deleteTodo(todo.id)}
                className="opacity-0 group-hover:opacity-100 p-2 text-gray-300 hover:text-red-400 transition-all"
              >
                <i className="fa-solid fa-trash-can"></i>
              </button>
            </div>
          ))}

          {todos.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-xs font-bold text-gray-300">暂无待办事项，享受你的空闲时光吧！</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TodoList;
