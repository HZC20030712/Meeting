import React from 'react';
import { User, Shield, Target, Activity } from 'lucide-react';
import { DeepInsightResult } from '../types';

interface PersonaHeaderProps {
  analysisResult?: DeepInsightResult | null;
  speakers: string[]; // Fallback if no analysis
}

const PersonaHeader: React.FC<PersonaHeaderProps> = ({ analysisResult, speakers }) => {
  const profiles = analysisResult?.speaker_profiles || [];

  if (profiles.length === 0) {
    // Fallback: Just show speaker list
    return (
      <div className="flex gap-4 p-4 overflow-x-auto border-b border-gray-100 bg-white/50 backdrop-blur-sm">
        {speakers.map((speaker, idx) => (
          <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full text-sm text-gray-600">
            <User size={14} />
            <span>{speaker}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-4 p-4 overflow-x-auto border-b border-gray-100 bg-white/50 backdrop-blur-sm">
      {profiles.map((profile, i) => (
        <div key={i} className="group relative">
          {/* Capsule Button */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-blue-100 shadow-sm rounded-full cursor-pointer hover:border-blue-300 transition-all">
            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold">
              {profile.name[0]}
            </div>
            <span className="text-sm font-medium text-gray-700">{profile.name}</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">{profile.stance}</span>
          </div>

          {/* Hover Card (The Capsule) */}
          <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
            <div className="flex items-center gap-2 mb-3">
              <User size={16} className="text-blue-500" />
              <span className="font-bold text-gray-900">{profile.name}</span>
            </div>
            
            <div className="space-y-3">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400 font-bold uppercase mb-1">
                  <Target size={12} /> 隐形议程
                </div>
                <p className="text-xs text-gray-700 leading-relaxed bg-gray-50 p-2 rounded">
                  {profile.hidden_agenda}
                </p>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400 font-bold uppercase mb-1">
                  <Activity size={12} /> 情绪曲线
                </div>
                <div className="flex flex-wrap gap-1">
                  {profile.emotion_curve.map((e, idx) => (
                    <span key={idx} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">
                      {e}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PersonaHeader;
