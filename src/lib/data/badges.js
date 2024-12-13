export const badges = {
  prayer: {
    streak: [
      {
        id: 'prayer_streak_1',
        name: 'Prayer Guardian I',
        description: 'Complete all daily prayers for 3 consecutive days',
        level: 1,
        category: 'prayer',
        image: '🌙', // Placeholder - we can replace with actual image paths
        requirement: { type: 'streak', count: 3 }
      },
      {
        id: 'prayer_streak_2',
        name: 'Prayer Guardian II',
        description: 'Complete all daily prayers for 7 consecutive days',
        level: 2,
        category: 'prayer',
        image: '🌙✨',
        requirement: { type: 'streak', count: 7 }
      },
      {
        id: 'prayer_streak_3',
        name: 'Prayer Guardian III',
        description: 'Complete all daily prayers for 30 consecutive days',
        level: 3,
        category: 'prayer',
        image: '🌙💫',
        requirement: { type: 'streak', count: 30 }
      }
    ],
    onTime: [
      {
        id: 'prayer_ontime_1',
        name: 'Early Riser I',
        description: 'Pray Fajr on time for 3 consecutive days',
        level: 1,
        category: 'prayer',
        image: '🌅',
        requirement: { type: 'ontime_fajr', count: 3 }
      },
      {
        id: 'prayer_ontime_2',
        name: 'Early Riser II',
        description: 'Pray Fajr on time for 7 consecutive days',
        level: 2,
        category: 'prayer',
        image: '🌅✨',
        requirement: { type: 'ontime_fajr', count: 7 }
      },
      {
        id: 'prayer_ontime_3',
        name: 'Early Riser III',
        description: 'Pray Fajr on time for 30 consecutive days',
        level: 3,
        category: 'prayer',
        image: '🌅💫',
        requirement: { type: 'ontime_fajr', count: 30 }
      }
    ]
  },
  quran: {
    reading: [
      {
        id: 'quran_time_1',
        name: 'Quran Reader I',
        description: 'Read Quran for 15 minutes daily for 3 days',
        level: 1,
        category: 'quran',
        image: '📖',
        requirement: { type: 'daily_reading', minutes: 15, days: 3 }
      },
      {
        id: 'quran_time_2',
        name: 'Quran Reader II',
        description: 'Read Quran for 30 minutes daily for 7 days',
        level: 2,
        category: 'quran',
        image: '📖✨',
        requirement: { type: 'daily_reading', minutes: 30, days: 7 }
      },
      {
        id: 'quran_time_3',
        name: 'Quran Reader III',
        description: 'Read Quran for 60 minutes daily for 30 days',
        level: 3,
        category: 'quran',
        image: '📖💫',
        requirement: { type: 'daily_reading', minutes: 60, days: 30 }
      }
    ],
    completion: [
      {
        id: 'quran_completion_1',
        name: 'Juz Explorer I',
        description: 'Complete reading 1 Juz',
        level: 1,
        category: 'quran',
        image: '🎯',
        requirement: { type: 'juz_completion', count: 1 }
      },
      {
        id: 'quran_completion_2',
        name: 'Juz Explorer II',
        description: 'Complete reading 5 Juz',
        level: 2,
        category: 'quran',
        image: '🎯✨',
        requirement: { type: 'juz_completion', count: 5 }
      },
      {
        id: 'quran_completion_3',
        name: 'Hafiz in Progress',
        description: 'Complete reading the entire Quran',
        level: 3,
        category: 'quran',
        image: '🎯💫',
        requirement: { type: 'juz_completion', count: 30 }
      }
    ]
  },
  dhikr: {
    daily: [
      {
        id: 'dhikr_daily_1',
        name: 'Dhikr Devotee I',
        description: 'Complete 100 dhikr in a day',
        level: 1,
        category: 'dhikr',
        image: '📿',
        requirement: { type: 'daily_dhikr', count: 100 }
      },
      {
        id: 'dhikr_daily_2',
        name: 'Dhikr Devotee II',
        description: 'Complete 500 dhikr in a day',
        level: 2,
        category: 'dhikr',
        image: '📿✨',
        requirement: { type: 'daily_dhikr', count: 500 }
      },
      {
        id: 'dhikr_daily_3',
        name: 'Dhikr Devotee III',
        description: 'Complete 1000 dhikr in a day',
        level: 3,
        category: 'dhikr',
        image: '📿💫',
        requirement: { type: 'daily_dhikr', count: 1000 }
      }
    ],
    streak: [
      {
        id: 'dhikr_streak_1',
        name: 'Consistent Remembrance I',
        description: 'Complete daily dhikr goal for 7 days',
        level: 1,
        category: 'dhikr',
        image: '🕌',
        requirement: { type: 'dhikr_streak', days: 7 }
      },
      {
        id: 'dhikr_streak_2',
        name: 'Consistent Remembrance II',
        description: 'Complete daily dhikr goal for 30 days',
        level: 2,
        category: 'dhikr',
        image: '🕌✨',
        requirement: { type: 'dhikr_streak', days: 30 }
      },
      {
        id: 'dhikr_streak_3',
        name: 'Consistent Remembrance III',
        description: 'Complete daily dhikr goal for 100 days',
        level: 3,
        category: 'dhikr',
        image: '🕌💫',
        requirement: { type: 'dhikr_streak', days: 100 }
      }
    ]
  },
  journal: {
    entries: [
      {
        id: 'journal_entries_1',
        name: 'Reflection Seeker I',
        description: 'Write 5 journal entries',
        level: 1,
        category: 'journal',
        image: '✍️',
        requirement: { type: 'journal_entries', count: 5 }
      },
      {
        id: 'journal_entries_2',
        name: 'Reflection Seeker II',
        description: 'Write 25 journal entries',
        level: 2,
        category: 'journal',
        image: '✍️✨',
        requirement: { type: 'journal_entries', count: 25 }
      },
      {
        id: 'journal_entries_3',
        name: 'Reflection Seeker III',
        description: 'Write 100 journal entries',
        level: 3,
        category: 'journal',
        image: '✍️💫',
        requirement: { type: 'journal_entries', count: 100 }
      }
    ],
    streak: [
      {
        id: 'journal_streak_1',
        name: 'Daily Reflector I',
        description: 'Write journal entries for 7 consecutive days',
        level: 1,
        category: 'journal',
        image: '📔',
        requirement: { type: 'journal_streak', days: 7 }
      },
      {
        id: 'journal_streak_2',
        name: 'Daily Reflector II',
        description: 'Write journal entries for 30 consecutive days',
        level: 2,
        category: 'journal',
        image: '📔✨',
        requirement: { type: 'journal_streak', days: 30 }
      },
      {
        id: 'journal_streak_3',
        name: 'Daily Reflector III',
        description: 'Write journal entries for 100 consecutive days',
        level: 3,
        category: 'journal',
        image: '📔💫',
        requirement: { type: 'journal_streak', days: 100 }
      }
    ]
  }
}; 