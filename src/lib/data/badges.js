export const badges = {
  prayer: {
    streak: [
      {
        id: 'prayer_streak_1',
        name: 'Prayer Guardian I',
        description: 'Complete all daily prayers for 3 consecutive days',
        level: 1,
        category: 'prayer',
        image: '🌙',
        requirement: {
          type: 'streak',
          count: 3
        }
      },
      {
        id: 'prayer_streak_2',
        name: 'Prayer Guardian II',
        description: 'Complete all daily prayers for 7 consecutive days',
        level: 2,
        category: 'prayer',
        image: '🌙',
        requirement: {
          type: 'streak',
          count: 7
        }
      },
      {
        id: 'prayer_streak_3',
        name: 'Prayer Guardian III',
        description: 'Complete all daily prayers for 30 consecutive days',
        level: 3,
        category: 'prayer',
        image: '🌙',
        requirement: {
          type: 'streak',
          count: 30
        }
      }
    ],
    ontime_fajr: [
      {
        id: 'prayer_ontime_1',
        name: 'Early Riser I',
        description: 'Pray Fajr on time for 3 consecutive days',
        level: 1,
        category: 'prayer',
        image: '☀️',
        requirement: {
          type: 'ontime_fajr',
          count: 3
        }
      },
      {
        id: 'prayer_ontime_2',
        name: 'Early Riser II',
        description: 'Pray Fajr on time for 7 consecutive days',
        level: 2,
        category: 'prayer',
        image: '☀️',
        requirement: {
          type: 'ontime_fajr',
          count: 7
        }
      },
      {
        id: 'prayer_ontime_3',
        name: 'Early Riser III',
        description: 'Pray Fajr on time for 30 consecutive days',
        level: 3,
        category: 'prayer',
        image: '☀️',
        requirement: {
          type: 'ontime_fajr',
          count: 30
        }
      }
    ]
  },
  quran: {
    daily_reading: [
      {
        id: 'quran_time_1',
        name: 'Quran Reader I',
        description: 'Read Quran for 15 minutes daily for 3 days',
        level: 1,
        category: 'quran',
        image: '📖',
        requirement: {
          type: 'daily_reading',
          minutes: 15,
          days: 3
        }
      },
      {
        id: 'quran_time_2',
        name: 'Quran Reader II',
        description: 'Read Quran for 30 minutes daily for 7 days',
        level: 2,
        category: 'quran',
        image: '📖',
        requirement: {
          type: 'daily_reading',
          minutes: 30,
          days: 7
        }
      },
      {
        id: 'quran_time_3',
        name: 'Quran Reader III',
        description: 'Read Quran for 60 minutes daily for 30 days',
        level: 3,
        category: 'quran',
        image: '📖',
        requirement: {
          type: 'daily_reading',
          minutes: 60,
          days: 30
        }
      }
    ],
    juz_completion: [
      {
        id: 'quran_completion_1',
        name: 'Juz Completion I',
        description: 'Complete 1 Juz of the Quran',
        level: 1,
        category: 'quran',
        image: '🌙',
        requirement: {
          type: 'juz_completion',
          count: 1
        }
      },
      {
        id: 'quran_completion_2',
        name: 'Juz Completion II',
        description: 'Complete 5 Juz of the Quran',
        level: 2,
        category: 'quran',
        image: '🌙',
        requirement: {
          type: 'juz_completion',
          count: 5
        }
      },
      {
        id: 'quran_completion_3',
        name: 'Juz Completion III',
        description: 'Complete all 30 Juz of the Quran',
        level: 3,
        category: 'quran',
        image: '🌙',
        requirement: {
          type: 'juz_completion',
          count: 30
        }
      }
    ]
  },
  dhikr: {
    daily_dhikr: [
      {
        id: 'dhikr_daily_1',
        name: 'Daily Dhikr I',
        description: 'Complete 100 dhikr in a day',
        level: 1,
        category: 'dhikr',
        image: '📿',
        requirement: {
          type: 'daily_dhikr',
          count: 100
        }
      },
      {
        id: 'dhikr_daily_2',
        name: 'Daily Dhikr II',
        description: 'Complete 500 dhikr in a day',
        level: 2,
        category: 'dhikr',
        image: '📿',
        requirement: {
          type: 'daily_dhikr',
          count: 500
        }
      },
      {
        id: 'dhikr_daily_3',
        name: 'Daily Dhikr III',
        description: 'Complete 1000 dhikr in a day',
        level: 3,
        category: 'dhikr',
        image: '📿',
        requirement: {
          type: 'daily_dhikr',
          count: 1000
        }
      }
    ],
    dhikr_streak: [
      {
        id: 'dhikr_streak_1',
        name: 'Dhikr Streak I',
        description: 'Complete daily dhikr for 3 consecutive days',
        level: 1,
        category: 'dhikr',
        image: '🤲',
        requirement: {
          type: 'dhikr_streak',
          days: 3
        }
      },
      {
        id: 'dhikr_streak_2',
        name: 'Dhikr Streak II',
        description: 'Complete daily dhikr for 7 consecutive days',
        level: 2,
        category: 'dhikr',
        image: '🤲',
        requirement: {
          type: 'dhikr_streak',
          days: 7
        }
      },
      {
        id: 'dhikr_streak_3',
        name: 'Dhikr Streak III',
        description: 'Complete daily dhikr for 30 consecutive days',
        level: 3,
        category: 'dhikr',
        image: '🤲',
        requirement: {
          type: 'dhikr_streak',
          days: 30
        }
      }
    ]
  },
  journal: {
    entries: [
      {
        id: 'journal_entries_1',
        name: 'Journal Keeper I',
        description: 'Write 3 journal entries',
        level: 1,
        category: 'journal',
        image: '✍️',
        requirement: {
          type: 'journal_entries',
          count: 3
        }
      },
      {
        id: 'journal_entries_2',
        name: 'Journal Keeper II',
        description: 'Write 7 journal entries',
        level: 2,
        category: 'journal',
        image: '✍️',
        requirement: {
          type: 'journal_entries',
          count: 7
        }
      },
      {
        id: 'journal_entries_3',
        name: 'Journal Keeper III',
        description: 'Write 30 journal entries',
        level: 3,
        category: 'journal',
        image: '✍️',
        requirement: {
          type: 'journal_entries',
          count: 30
        }
      }
    ],
    streak: [
      {
        id: 'journal_streak_1',
        name: 'Journal Streak I',
        description: 'Write journal entries for 3 consecutive days',
        level: 1,
        category: 'journal',
        image: '📝',
        requirement: {
          type: 'journal_streak',
          days: 3
        }
      },
      {
        id: 'journal_streak_2',
        name: 'Journal Streak II',
        description: 'Write journal entries for 7 consecutive days',
        level: 2,
        category: 'journal',
        image: '📝',
        requirement: {
          type: 'journal_streak',
          days: 7
        }
      },
      {
        id: 'journal_streak_3',
        name: 'Journal Streak III',
        description: 'Write journal entries for 30 consecutive days',
        level: 3,
        category: 'journal',
        image: '📝',
        requirement: {
          type: 'journal_streak',
          days: 30
        }
      }
    ]
  }
}; 