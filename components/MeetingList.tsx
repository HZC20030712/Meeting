
import React from 'react';
import { Meeting } from '../types';

interface MeetingListProps {
  meetings: Meeting[];
  onMeetingClick?: (meeting: Meeting) => void;
}

const MeetingList: React.FC<MeetingListProps> = ({ meetings, onMeetingClick }) => {
  // Group meetings by date for sectioning
  const groups = meetings.reduce((acc, meeting) => {
    if (!acc[meeting.date]) acc[meeting.date] = [];
    acc[meeting.date].push(meeting);
    return acc;
  }, {} as Record<string, Meeting[]>);

  // Sort groups: "刚刚" first, then others
  const sortedDates = Object.keys(groups).sort((a, b) => {
    if (a === '刚刚') return -1;
    if (b === '刚刚') return 1;
    return b.localeCompare(a);
  });

  return (
    <div className="space-y-8 pb-10">
      {sortedDates.map((date) => (
        <div key={date} className="animate-in fade-in slide-in-from-bottom-2 duration-700">
          <div className="flex items-center gap-4 mb-4 px-1">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] whitespace-nowrap">
              {date}
            </span>
            <div className="h-[1px] flex-1 bg-gray-100/50"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(groups[date] as Meeting[]).map((meeting) => (
              <div 
                key={meeting.id}
                onClick={() => onMeetingClick && onMeetingClick(meeting)}
                className={`
                  group bg-white hover:bg-gray-50 border border-gray-100 rounded-2xl p-5 transition-all active:scale-[0.99] flex items-center gap-5 shadow-sm hover:shadow-xl hover:shadow-gray-200/40 cursor-pointer
                  ${date === '刚刚' ? 'ring-2 ring-[#33a3dc]/20 bg-blue-50/10 border-[#33a3dc]/20' : ''}
                `}
              >
                <div className={`
                  w-12 h-12 rounded-2xl flex items-center justify-center transition-all border border-gray-50
                  ${meeting.type === 'interview' ? 'bg-green-50 text-green-600' : 
                    meeting.type === 'strategy' ? 'bg-orange-50 text-orange-500' :
                    'bg-gray-50 text-gray-400 group-hover:bg-[#F0F9FF] group-hover:text-[#33a3dc]'}
                `}>
                   <i className={`fa-solid ${
                     meeting.type === 'interview' ? 'fa-user-tie' : 
                     meeting.type === 'strategy' ? 'fa-chess' : 
                     meeting.type === 'product' ? 'fa-box-archive' : 'fa-file-lines'
                   } text-xl`}></i>
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="text-[15px] font-black text-gray-900 truncate group-hover:text-[#33a3dc] transition-colors tracking-tight">
                    {meeting.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-bold text-gray-400">{meeting.host}</span>
                    <span className="w-1 h-1 rounded-full bg-gray-200"></span>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                      meeting.type === 'strategy' ? 'bg-orange-50 text-orange-500' : 
                      meeting.type === 'interview' ? 'bg-green-50 text-green-500' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {meeting.type}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                   <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-xl border border-gray-100 group-hover:border-[#33a3dc]/20 transition-colors">
                      <i className="fa-solid fa-clock text-[9px] text-gray-400"></i>
                      <span className="text-[10px] font-black text-gray-600">{meeting.duration}</span>
                   </div>
                   <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">{meeting.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default MeetingList;
