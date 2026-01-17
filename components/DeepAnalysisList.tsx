import React, { useState } from 'react';
import { AnalysisResult, ProjectStandardResult, DeepInsightResult, CrossroadsResult } from '../types';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Lightbulb, 
  User, 
  Milestone, 
  GitFork, 
  ArrowRight,
  TrendingUp,
  BrainCircuit,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DeepAnalysisListProps {
  analysisResult: AnalysisResult | null;
  speakerMap: Record<string, string>;
  onSeek: (time: string) => void;
}

const DeepAnalysisList: React.FC<DeepAnalysisListProps> = ({ analysisResult, speakerMap, onSeek }) => {
  if (!analysisResult) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-2xl">
          <BrainCircuit className="text-gray-300 w-8 h-8" />
        </div>
        <p className="text-sm font-medium text-gray-500 mb-1">暂无深度解读</p>
        <p className="text-xs">点击上方按钮开始分析</p>
      </div>
    );
  }

  const renderProjectStandard = (data: ProjectStandardResult) => (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Summary Card */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100 shadow-sm">
        <h4 className="text-xs font-bold text-blue-600 uppercase mb-2 flex items-center gap-1.5">
          <CheckCircle2 size={14} /> 执行摘要
        </h4>
        <p className="text-sm text-gray-800 font-medium leading-relaxed">{data.meta.summary}</p>
      </div>

      {/* Action Items */}
      <section>
        <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
          待办事项 <span className="bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded text-[10px]">{data.action_items.length}</span>
        </h4>
        <div className="space-y-3">
          {data.action_items.map((item, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm hover:border-blue-200 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  item.priority === 'High' ? 'bg-red-50 text-red-600' :
                  item.priority === 'Medium' ? 'bg-yellow-50 text-yellow-600' : 'bg-green-50 text-green-600'
                }`}>
                  {item.priority}
                </span>
                <span 
                  onClick={() => onSeek(item.timestamp)}
                  className="text-[10px] font-mono text-gray-400 hover:text-blue-500 cursor-pointer"
                >
                  {item.timestamp}
                </span>
              </div>
              <p className="text-sm text-gray-800 font-medium mb-2">{item.task}</p>
              <div className="flex justify-between items-center text-xs text-gray-500">
                <span className="flex items-center gap-1"><User size={12} /> {item.owner}</span>
                {item.deadline !== '待定' && <span>截止: {item.deadline}</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Decisions */}
      <section>
        <h4 className="text-sm font-bold text-gray-800 mb-3">关键决议</h4>
        <div className="space-y-2">
          {data.decisions.map((d, i) => (
            <div key={i} className="flex gap-3 items-start p-2 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></div>
              <div className="flex-1">
                <p className="text-sm text-gray-700 font-medium">{d.content}</p>
                <span onClick={() => onSeek(d.timestamp)} className="text-[10px] font-mono text-gray-400 cursor-pointer">{d.timestamp}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Milestones */}
      {data.key_milestones.length > 0 && (
        <section>
          <h4 className="text-sm font-bold text-gray-800 mb-3">项目里程碑</h4>
          <div className="relative pl-4 border-l-2 border-gray-100 space-y-4">
            {data.key_milestones.map((m, i) => (
              <div key={i} className="relative">
                <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-white border-2 border-blue-500"></div>
                <div className="text-xs font-bold text-blue-600 mb-0.5">{m.date}</div>
                <div className="text-sm text-gray-800 font-medium">{m.event}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );

  const renderDeepInsight = (data: DeepInsightResult) => (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Speaker Profiles / Radar-like cards */}
      <section>
        <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
          人物人格建模 <TrendingUp size={16} className="text-blue-500" />
        </h4>
        <div className="grid grid-cols-1 gap-4">
          {data.speaker_profiles.map((profile, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <User size={20} />
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900">{profile.name}</div>
                  <div className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full inline-block mt-1">
                    立场: {profile.stance}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs">
                  <span className="text-gray-400 font-bold uppercase block mb-1">隐形议程</span>
                  <p className="text-gray-700 font-medium">{profile.hidden_agenda}</p>
                </div>
                <div className="text-xs">
                  <span className="text-gray-400 font-bold uppercase block mb-1">情绪曲线</span>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.emotion_curve.map((ec, idx) => (
                      <span key={idx} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-medium">
                        {ec}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Insights Timeline */}
      <section>
        <h4 className="text-sm font-bold text-gray-800 mb-4">言外之意时间轴</h4>
        <div className="space-y-6 relative">
          <div className="absolute left-[19px] top-2 bottom-2 w-[1px] bg-gray-100"></div>
          {data.insights.map((insight, i) => (
            <div key={i} className="flex gap-4 relative group">
              <div className="w-10 flex flex-col items-center shrink-0">
                <div 
                  onClick={() => onSeek(insight.timestamp)}
                  className="w-10 h-10 rounded-full bg-white border border-gray-100 shadow-sm flex items-center justify-center text-[10px] font-mono text-gray-400 group-hover:text-blue-500 group-hover:border-blue-200 cursor-pointer transition-all z-10"
                >
                  {insight.timestamp.split(':').slice(0, 2).join(':')}
                </div>
              </div>
              <div className={`flex-1 bg-white border rounded-2xl p-4 shadow-sm transition-all group-hover:shadow-md ${
                insight.risk_level === 'High' ? 'border-red-100 ring-1 ring-red-50' : 'border-gray-100'
              }`}>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-gray-900">{insight.speaker}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      {insight.intent_tag}
                    </span>
                    {insight.risk_level === 'High' && (
                      <ShieldAlert size={14} className="text-red-500 animate-pulse" />
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-400 italic mb-3 line-clamp-2 border-l-2 border-gray-100 pl-2">
                  "{insight.original_text}"
                </p>
                <div className="text-sm text-gray-800 font-bold leading-relaxed flex gap-2">
                  <Lightbulb size={16} className="text-yellow-400 shrink-0 mt-0.5" />
                  <span>{insight.subtext}</span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden mr-3">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-1000" 
                      style={{ width: `${insight.confidence * 100}%`, opacity: insight.confidence }}
                    ></div>
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono">
                    置信度 {Math.round(insight.confidence * 100)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  const renderCrossroads = (data: CrossroadsResult) => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
        关键决策点推演 <GitFork size={16} className="text-purple-500" />
      </h4>
      <div className="space-y-6 relative pl-6 border-l-2 border-dashed border-purple-100">
        {data.decision_points.map((dp, i) => (
          <div key={i} className="relative group">
            <div className="absolute -left-[35px] top-0 w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 border border-purple-100 group-hover:scale-110 transition-transform z-10">
              <GitFork size={16} />
            </div>
            
            <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm group-hover:shadow-md transition-shadow">
              <div className="flex justify-between items-center mb-3">
                <span 
                  onClick={() => onSeek(dp.timestamp)}
                  className="text-xs font-mono text-purple-600 bg-purple-50 px-2 py-0.5 rounded cursor-pointer"
                >
                  {dp.timestamp}
                </span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">博弈节点</span>
              </div>
              
              <div className="space-y-4">
                <section>
                  <h5 className="text-[10px] font-bold text-gray-400 uppercase mb-1">当时语境</h5>
                  <p className="text-xs text-gray-700 font-medium">{dp.context}</p>
                </section>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                    <h5 className="text-[10px] font-bold text-gray-400 uppercase mb-1 flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-gray-400"></span> 实际动作
                    </h5>
                    <p className="text-xs text-gray-600 font-medium mb-1.5">{dp.actual_move}</p>
                    <p className="text-[10px] text-gray-400 italic">结果: {dp.actual_outcome}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-2.5 border border-green-100">
                    <h5 className="text-[10px] font-bold text-green-600 uppercase mb-1 flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></span> 平行宇宙建议
                    </h5>
                    <p className="text-xs text-green-700 font-bold mb-1.5">{dp.alternative_move}</p>
                    <p className="text-[10px] text-green-600 font-medium">预期结果: {dp.simulated_outcome}</p>
                  </div>
                </div>

                <section className="bg-purple-50/50 rounded-lg p-3 border border-purple-100/50">
                  <h5 className="text-[10px] font-bold text-purple-600 uppercase mb-1 flex items-center gap-1">
                    <BrainCircuit size={12} /> 博弈论深度分析
                  </h5>
                  <p className="text-xs text-purple-800 font-medium leading-relaxed italic">
                    {dp.game_theory_analysis}
                  </p>
                </section>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="h-full">
      <AnimatePresence mode="wait">
        <motion.div
          key={analysisResult.mode}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          {analysisResult.mode === 'project_standard' && renderProjectStandard(analysisResult)}
          {analysisResult.mode === 'deep_insight' && renderDeepInsight(analysisResult)}
          {analysisResult.mode === 'crossroads' && renderCrossroads(analysisResult)}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default DeepAnalysisList;
