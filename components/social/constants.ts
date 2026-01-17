import { Profile } from './types';

export const HISTORY_PROFILES: Profile[] = [
  {
    id: 'h1',
    name: '林婉儿',
    role: '首席战略官 (CSO)',
    company: '智网科技',
    avatarUrl: 'https://picsum.photos/id/1011/200/200',
    tags: ['AI 基础设施', '决策人', 'B轮融资'],
    upcomingMeeting: {
      id: 'm1',
      date: '1月16日',
      title: 'Q1 战略合作伙伴同步会',
      location: 'A号董事会议室 · 总部',
      time: '14:00 - 15:30'
    },
    icebreakers: [
      { id: 'i1', category: 'Professional', text: '询问关于收购 DeepCore 后的整合进展。', iconType: 'book' },
      { id: 'i2', category: 'Interest', text: '她最近刚完成了东京马拉松。', iconType: 'star' }
    ],
    nudge: '林总崇尚简洁。先讲“为什么”，再讲“怎么做”。'
  },
  {
    id: 'h2',
    name: '陈志宏',
    role: '工程副总裁',
    company: '云际全球',
    avatarUrl: 'https://picsum.photos/id/1005/200/200',
    tags: ['云架构', '技术专家', '企业级服务'],
    upcomingMeeting: {
      id: 'm2',
      date: '1月18日',
      title: '技术可行性评审',
      location: '线上 · Google Meet',
      time: '10:00 - 11:00'
    },
    icebreakers: [
      { id: 'i5', category: 'Interest', text: '复古机械键盘的狂热收藏家。', iconType: 'star' }
    ],
    nudge: '陈总非常看重数据。请在第二页幻灯片准备好具体的性能指标。'
  }
];

export const NEW_MEETING_PROFILES: Profile[] = [
  {
    id: 'n1',
    name: '莎拉·詹金斯',
    role: '运营总监',
    company: '物流流转公司',
    avatarUrl: 'https://picsum.photos/id/338/200/200',
    tags: ['供应链', '全球运营', '流程优化'],
    upcomingMeeting: {
      id: 'm3',
      date: '1月20日',
      title: '供应链优化研讨会',
      location: 'B号会议室',
      time: '09:00 - 12:00'
    },
    icebreakers: [
      { id: 'i7', category: 'Professional', text: '询问新贸易法规对跨境物流的影响。', iconType: 'book' },
      { id: 'i9', category: 'Dynamic', text: '公司正计划向东南亚市场扩张。', iconType: 'zap' }
    ],
    nudge: '莎拉喜欢视觉化的表达。请务必带上流程图。'
  },
  {
    id: 'n2',
    name: '李凯文',
    role: '产品设计总监',
    company: '未来视界',
    avatarUrl: 'https://picsum.photos/id/64/200/200',
    tags: ['UX/UI', '设计思维', '创新'],
    upcomingMeeting: {
      id: 'm3',
      date: '1月20日',
      title: '供应链优化研讨会',
      location: 'B号会议室',
      time: '09:00 - 12:00'
    },
    icebreakers: [
      { id: 'i10', category: 'Professional', text: '祝贺他们获得了红点设计大奖。', iconType: 'book' },
      { id: 'i11', category: 'Interest', text: '平时喜欢在周末去冲浪。', iconType: 'star' }
    ],
    nudge: '凯文注重细节体验，展示Demo时请确保交互流畅。'
  }
];

// Combine for backward compatibility if needed, though we will use split lists now
export const MOCK_PROFILES = [...HISTORY_PROFILES, ...NEW_MEETING_PROFILES];
