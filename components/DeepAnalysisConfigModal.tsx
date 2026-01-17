import React, { useState, useEffect } from 'react';

interface Preset {
  id: string;
  name: string;
  description: string;
}

interface DeepAnalysisConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartAnalysis: (config: {
    speaker_map: Record<string, string>;
    ignored_speakers: string[];
    preset_id: string;
    custom_requirement: string;
  }) => void;
  speakers: string[]; // unique speaker IDs
  initialSpeakerMap: Record<string, string>;
}

const DeepAnalysisConfigModal: React.FC<DeepAnalysisConfigModalProps> = ({
  isOpen,
  onClose,
  onStartAnalysis,
  speakers,
  initialSpeakerMap,
}) => {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [customRequirement, setCustomRequirement] = useState('');
  const [localSpeakerMap, setLocalSpeakerMap] = useState<Record<string, string>>({});
  const [ignoredSpeakers, setIgnoredSpeakers] = useState<Set<string>>(new Set());
  const [loadingPresets, setLoadingPresets] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLocalSpeakerMap({ ...initialSpeakerMap });
      // Fetch presets
      setLoadingPresets(true);
      fetch('http://localhost:8000/api/presets') // assuming localhost for dev
        .then(res => res.json())
        .then(data => {
            setPresets(data);
            if (data.length > 0) setSelectedPreset(data[0].id);
        })
        .catch(err => console.error(err))
        .finally(() => setLoadingPresets(false));
    }
  }, [isOpen, initialSpeakerMap]);

  const handleNameChange = (id: string, newName: string) => {
    setLocalSpeakerMap(prev => ({ ...prev, [id]: newName }));
  };

  const toggleIgnore = (id: string) => {
    const next = new Set(ignoredSpeakers);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setIgnoredSpeakers(next);
  };

  const handleConfirm = () => {
    onStartAnalysis({
      speaker_map: localSpeakerMap,
      ignored_speakers: Array.from(ignoredSpeakers),
      preset_id: selectedPreset,
      custom_requirement: customRequirement
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-[600px] max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-lg font-bold text-gray-800">深度解读配置</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Speaker Check */}
          <section>
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
              发言人确认
            </h3>
            <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 bg-gray-100 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">原始标识</th>
                    <th className="px-4 py-3">显示名称 (可编辑)</th>
                    <th className="px-4 py-3 text-center">参与分析</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {speakers.map(id => (
                    <tr key={id} className="hover:bg-white transition-colors">
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{id}</td>
                      <td className="px-4 py-2">
                        <input 
                          type="text" 
                          value={localSpeakerMap[id] || (initialSpeakerMap[id]) || (id === 'unknown_speaker_default' ? '未知发言人' : id)}
                          onChange={(e) => handleNameChange(id, e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded px-2 py-1.5 focus:ring-2 focus:ring-blue-100 outline-none text-gray-800 font-medium"
                          placeholder="输入姓名"
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <input 
                          type="checkbox" 
                          checked={!ignoredSpeakers.has(id)}
                          onChange={() => toggleIgnore(id)}
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-2 ml-1">* 修改名称将同步更新至全文转写</p>
          </section>

          {/* Section 2: Presets */}
          <section>
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-purple-500 rounded-full"></span>
              选择分析模版
            </h3>
            {loadingPresets ? (
              <div className="text-sm text-gray-400 py-4">加载模版中...</div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {presets.map(p => (
                  <div 
                    key={p.id}
                    onClick={() => setSelectedPreset(p.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedPreset === p.id 
                        ? 'border-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-500' 
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-bold text-sm text-gray-800 mb-1">{p.name}</div>
                    <div className="text-xs text-gray-500 line-clamp-2">{p.description}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section 3: Custom Prompt */}
          <section>
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-green-500 rounded-full"></span>
              自定义补充要求
            </h3>
            <textarea
              value={customRequirement}
              onChange={(e) => setCustomRequirement(e.target.value)}
              placeholder="例如：重点关注关于产品定价的讨论，或者忽略闲聊部分..."
              className="w-full h-24 p-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-100 outline-none resize-none"
            />
          </section>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            取消
          </button>
          <button 
            onClick={handleConfirm}
            disabled={!selectedPreset}
            className={`px-6 py-2 text-sm font-bold text-white rounded-lg shadow-sm transition-all ${
              selectedPreset 
                ? 'bg-blue-600 hover:bg-blue-700 hover:shadow-md' 
                : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            <i className="fa-solid fa-wand-magic-sparkles mr-2"></i>
            开始深度解读
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeepAnalysisConfigModal;
