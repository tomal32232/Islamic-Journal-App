<script>
  import { auth } from '../firebase';
  import { prayerHistoryStore } from '../stores/prayerHistoryStore';
  import { weeklyStatsStore } from '../stores/tasbihStore';
  import { badgeStore } from '../stores/badgeStore';
  import { Bell, Trophy, Target, Book, ChartBar, SignOut, CaretRight, ArrowRight, Mosque, Sun, BookBookmark, HandsPraying, Sparkle, Pencil, CalendarPlus } from 'phosphor-svelte';
  import Toast from '../components/Toast.svelte';
  import { currentPage } from '../stores/pageStore';
  import { goalStore } from '../stores/goalStore';
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { getTodayReadingTime } from '../services/readingTimeService';

  const user = auth.currentUser;
  let prayerStats = { onTime: 0, late: 0, missed: 0, total: 0 };
  let earnedBadges = [];
  let allBadges = badgeStore.getAllBadges();
  let activeTab = 'profile';
  let showToast = false;
  let toastMessage = '';
  let todayReadingTime = 0;
  let todayDhikrCount = 0;

  function showErrorToast(message) {
    toastMessage = message;
    showToast = true;
    setTimeout(() => {
      showToast = false;
    }, 3000);
  }

  // Initialize badge store when component mounts
  $: if (user?.uid) {
    badgeStore.init(user.uid);
  }

  // Update earned badges when store changes
  $: if ($badgeStore) {
    earnedBadges = badgeStore.getEarnedBadges($badgeStore.earnedBadges);
  }

  // Calculate badge progress
  function getBadgeProgress(badge) {
    if (!$badgeStore?.progress) return 0;
    
    const progress = $badgeStore.progress;
    let current = 0;
    let target = 0;

    switch (badge.requirement.type) {
      case 'streak':
        current = progress['streak'] || 0;
        target = badge.requirement.count;
        break;
      case 'ontime_fajr':
        current = progress['ontime_fajr'] || 0;
        target = badge.requirement.count;
        break;
      case 'daily_reading':
        current = progress['daily_reading'] || 0;
        target = badge.requirement.minutes;
        break;
      case 'juz_completion':
        current = progress['juz_completion'] || 0;
        target = badge.requirement.count;
        break;
      case 'daily_dhikr':
        current = progress['daily_dhikr'] || 0;
        target = badge.requirement.count;
        break;
      case 'dhikr_streak':
        current = progress['dhikr_streak'] || 0;
        target = badge.requirement.days;
        break;
      case 'journal_entries':
        current = progress['journal_entries'] || 0;
        target = badge.requirement.count;
        break;
      case 'journal_streak':
        current = progress['journal_streak'] || 0;
        target = badge.requirement.days;
        break;
    }

    return Math.min((current / target) * 100, 100);
  }

  // Get in-progress badges
  $: inProgressBadges = Object.values(allBadges)
    .flatMap(category => Object.values(category).flat())
    .filter(badge => {
      const progress = getBadgeProgress(badge);
      return progress > 0 && progress < 100 && !earnedBadges.some(eb => eb.id === badge.id);
    })
    .sort((a, b) => getBadgeProgress(b) - getBadgeProgress(a))
    .slice(0, 3); // Show top 3 in-progress badges

  // Get first badge from each category
  function getFirstBadgeFromCategory(category) {
    const categoryBadges = allBadges[category];
    const firstBadgeType = Object.keys(categoryBadges)[0];
    const badge = categoryBadges[firstBadgeType][0];
    return {
      ...badge,
      unlocked: earnedBadges.some(eb => eb.id === badge.id)
    };
  }

  // Get total badges count
  function getTotalBadgesCount() {
    return Object.values(allBadges).reduce((total, category) => {
      return total + Object.values(category).reduce((sum, badges) => sum + badges.length, 0);
    }, 0);
  }

  // Get earned badges count
  $: earnedBadgesCount = earnedBadges.length;

  // Calculate prayer statistics when prayerHistoryStore changes
  $: if ($prayerHistoryStore?.history) {
    const today = new Date().toLocaleDateString('en-CA');
    const todaysPrayers = $prayerHistoryStore.history.filter(p => p.date === today);
    
    prayerStats = {
      total: todaysPrayers.length || 0,
      onTime: todaysPrayers.filter(p => p.status === 'ontime').length || 0,
      late: todaysPrayers.filter(p => p.status === 'late').length || 0,
      missed: todaysPrayers.filter(p => p.status === 'missed').length || 0
    };
  }

  // Update today's reading time
  async function updateTodayReadingTime() {
    const seconds = await getTodayReadingTime();
    todayReadingTime = Math.floor(seconds / 60); // Convert to minutes
  }

  // Update today's dhikr count
  $: if ($weeklyStatsStore?.dailyCounts?.length > 0) {
    const today = $weeklyStatsStore.dailyCounts.find(d => d.isToday);
    todayDhikrCount = today?.count || 0;
  }

  // Goals data
  $: goals = [
    { 
      name: 'Daily Prayers (On Time)', 
      target: $goalStore.dailyPrayers, 
      current: prayerStats.onTime,
      type: 'dailyPrayers',
      unit: ''
    },
    { 
      name: 'Daily Quran Reading', 
      target: $goalStore.dailyQuranReading, 
      current: todayReadingTime, 
      type: 'dailyQuranReading',
      unit: 'minutes',
      displayTarget: formatTimeDisplay($goalStore.dailyQuranReading),
      isTimeInput: true
    },
    { 
      name: 'Daily Dhikr', 
      target: $goalStore.dailyDhikr, 
      current: todayDhikrCount,
      type: 'dailyDhikr',
      unit: ''
    }
  ];

  let editingGoal = null;
  let editHours = '0';
  let editMinutes = '0';
  let editValue = '';

  function formatTimeDisplay(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  }

  function startEditing(goal) {
    editingGoal = goal;
    if (goal.isTimeInput) {
      const totalMinutes = goal.target;
      editHours = Math.floor(totalMinutes / 60).toString();
      editMinutes = (totalMinutes % 60).toString();
    } else {
      editValue = goal.target.toString();
    }
  }

  async function saveGoal() {
    if (!editingGoal) return;
    
    if (editingGoal.isTimeInput) {
      const hours = parseInt(editHours) || 0;
      const minutes = parseInt(editMinutes) || 0;
      const totalMinutes = (hours * 60) + minutes;
      
      if (totalMinutes < 1) {
        showErrorToast('Please enter a valid time greater than 0');
        return;
      }
      
      await goalStore.updateGoal(editingGoal.type, totalMinutes);
    } else {
      const value = parseInt(editValue);
      if (isNaN(value) || value < 1) {
        showErrorToast('Please enter a valid number greater than 0');
        return;
      }

      if (editingGoal.type === 'dailyPrayers' && value > 5) {
        showErrorToast('Daily prayers goal cannot exceed 5');
        return;
      }
      
      await goalStore.updateGoal(editingGoal.type, value);
    }
    
    editingGoal = null;
  }

  onMount(async () => {
    await goalStore.loadGoals();
    await updateTodayReadingTime();
  });

  // Handle logout
  async function handleLogout() {
    try {
      await auth.signOut();
      currentPage.set('home');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  }

  // Favorite verses (to be implemented)
  const favoriteVerses = [
    { surah: 'Al-Fatiha', verse: 1, text: 'In the name of Allah, the Most Gracious, the Most Merciful' },
    { surah: 'Al-Baqarah', verse: 255, text: 'Allah - there is no deity except Him, the Ever-Living, the Self-Sustaining' }
  ];

  export let navigateTo;

  function getBadgeIcon(badge) {
    if (badge.category === 'prayer') {
      if (badge.requirement.type === 'streak') return Mosque;
      if (badge.requirement.type === 'ontime_fajr') return Sun;
    }
    if (badge.category === 'quran') {
      if (badge.requirement.type === 'daily_reading') return Book;
      if (badge.requirement.type === 'juz_completion') return BookBookmark;
    }
    if (badge.category === 'dhikr') {
      if (badge.requirement.type === 'daily_dhikr') return HandsPraying;
      if (badge.requirement.type === 'dhikr_streak') return Sparkle;
    }
    if (badge.category === 'journal') {
      if (badge.requirement.type === 'journal_entries') return Pencil;
      if (badge.requirement.type === 'journal_streak') return CalendarPlus;
    }
    return Trophy;
  }
</script>

{#if showToast}
  <div class="toast" transition:fade>
    {toastMessage}
  </div>
{/if}

<Toast />

<main class="profile-container">
  <div class="profile-content">
    <!-- Basic User Info Card -->
    <div class="card user-info">
      <img 
        src={user?.photoURL || 'default-avatar.png'} 
        alt="Profile" 
        class="profile-image"
      />
      <div class="user-details">
        <h2>{user?.displayName || 'User'}</h2>
        <p class="email">{user?.email}</p>
      </div>
    </div>

    <!-- Prayer Statistics Card -->
    <div class="card">
      <h3><ChartBar weight="fill" /> Prayer Statistics</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-value">{prayerStats.onTime}</span>
          <span class="stat-label">On Time</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{prayerStats.late}</span>
          <span class="stat-label">Late</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{prayerStats.missed}</span>
          <span class="stat-label">Missed</span>
        </div>
      </div>
    </div>

    <!-- Achievement Badges Card -->
    <div class="badges-section">
      <div class="section-header">
        <h2>
          <Trophy weight="fill" />
          Achievement Badges
        </h2>
        <span class="badge-count">{earnedBadges.length}/{getTotalBadgesCount()}</span>
      </div>
      <div class="badges-preview">
        {#each inProgressBadges as badge}
          <div class="badge-item">
            <div class="badge-icon" data-level={badge.level}>
              <svelte:component this={getBadgeIcon(badge)} size={20} weight="fill" />
            </div>
            <div class="badge-details">
              <span class="badge-name">{badge.name}</span>
              <div class="progress-bar">
                <div class="progress" style="width: {getBadgeProgress(badge)}%"></div>
              </div>
            </div>
            <span class="progress-text">{Math.round(getBadgeProgress(badge))}%</span>
          </div>
        {/each}
      </div>
      <button class="view-all" on:click={() => navigateTo('badges')}>
        <span>View All Badges</span>
        <ArrowRight weight="bold" />
      </button>
    </div>

    <!-- Personal Goals Card -->
    <div class="card">
      <h3><Target weight="fill" /> Daily Goals</h3>
      <div class="goals-list">
        {#each goals as goal}
          <div class="goal-item">
            <div class="goal-info">
              <span class="goal-name">{goal.name}</span>
              {#if editingGoal?.type === goal.type}
                <div class="edit-input">
                  {#if goal.isTimeInput}
                    <div class="time-input">
                      <input 
                        type="number" 
                        bind:value={editHours}
                        min="0"
                        placeholder="Hours"
                      >
                      <span>h</span>
                      <input 
                        type="number" 
                        bind:value={editMinutes}
                        min="0"
                        max="59"
                        placeholder="Minutes"
                      >
                      <span>m</span>
                    </div>
                  {:else}
                    <input 
                      type="number" 
                      bind:value={editValue}
                      min="1"
                      on:keydown={(e) => e.key === 'Enter' && saveGoal()}
                    >
                  {/if}
                  <button class="save-btn" on:click={saveGoal}>Save</button>
                </div>
              {:else}
                <div class="goal-target">
                  <span class="goal-progress">
                    {#if goal.isTimeInput}
                      {formatTimeDisplay(goal.current)}/{goal.displayTarget}
                    {:else}
                      {goal.current}/{goal.target} {goal.unit}
                    {/if}
                  </span>
                  <button class="edit-btn" on:click={() => startEditing(goal)}>
                    <Pencil size={14} />
                  </button>
                </div>
              {/if}
            </div>
            <div class="progress-bar">
              <div class="progress" style="width: {(goal.current / goal.target) * 100}%"></div>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Favorite Verses Card -->
    <div class="card">
      <h3><Book weight="fill" /> Favorite Verses</h3>
      <div class="verses-list">
        {#each favoriteVerses as verse}
          <div class="verse-item">
            <div class="verse-header">
              <span class="surah-name">{verse.surah}</span>
              <span class="verse-number">Verse {verse.verse}</span>
            </div>
            <p class="verse-text">{verse.text}</p>
          </div>
        {/each}
      </div>
    </div>

    <!-- Reminders Settings Card -->
    <div class="card">
      <h3><Bell weight="fill" /> Prayer Reminders</h3>
      <div class="reminders-settings">
        <label class="reminder-toggle">
          <span>Prayer Time Notifications</span>
          <input type="checkbox" checked>
          <span class="toggle-slider"></span>
        </label>
        <label class="reminder-toggle">
          <span>Missed Prayer Alerts</span>
          <input type="checkbox" checked>
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>

    <!-- Sign Out Button -->
    <button class="sign-out-button" on:click={handleLogout}>
      <SignOut weight="bold" />
      Sign Out
    </button>
  </div>
</main>

<style>
  .profile-container {
    padding: 1rem;
    padding-bottom: 64px;
    background: #F8FAFC;
    min-height: 100vh;
    overflow-y: auto;
  }

  .profile-content {
    max-width: 600px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .card {
    background: white;
    padding: 1rem;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .profile-image {
    width: 80px;
    height: 80px;
    border-radius: 40px;
    object-fit: cover;
  }

  .user-details h2 {
    margin: 0;
    font-size: 1.25rem;
    color: #216974;
  }

  .email {
    color: #666;
    font-size: 0.875rem;
    margin: 0;
  }

  h3 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #216974;
    font-size: 1rem;
    margin: 0 0 1rem 0;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }

  .stat-item {
    text-align: center;
  }

  .stat-value {
    display: block;
    font-size: 1.5rem;
    font-weight: 500;
    color: #216974;
  }

  .stat-label {
    font-size: 0.875rem;
    color: #666;
  }

  .badges-section {
    background: white;
    border-radius: 12px;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  h2 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    font-size: 1rem;
    color: #216974;
  }

  .badge-count {
    font-size: 0.875rem;
    color: #216974;
    font-weight: 500;
  }

  .badges-preview {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .badge-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem;
    border-radius: 6px;
    background: #F8FAFC;
  }

  .badge-icon {
    width: 2.25rem;
    height: 2.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: white;
    border: 1px solid rgba(190, 159, 104, 0.2);
    color: #BE9F68;
    border-radius: 4px;
    flex-shrink: 0;
    position: relative;
  }

  .badge-icon::after {
    content: attr(data-level);
    position: absolute;
    bottom: -2px;
    right: -2px;
    background: #BE9F68;
    color: white;
    font-size: 0.625rem;
    font-weight: 600;
    min-width: 12px;
    height: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    padding: 1px;
  }

  .badge-details {
    flex: 1;
    min-width: 0;
  }

  .badge-name {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: #216974;
    margin-bottom: 0.25rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .progress-bar {
    height: 3px;
    background: rgba(33, 105, 116, 0.1);
    border-radius: 1.5px;
    overflow: hidden;
  }

  .progress {
    height: 100%;
    background: #216974;
    border-radius: 1.5px;
    transition: width 0.3s ease;
  }

  .progress-text {
    font-size: 0.75rem;
    color: #216974;
    font-weight: 500;
    min-width: 2.5rem;
    text-align: right;
  }

  .view-all {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: none;
    border: 1px solid rgba(33, 105, 116, 0.2);
    border-radius: 6px;
    color: #216974;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .view-all:hover {
    background: rgba(33, 105, 116, 0.05);
  }

  .goals-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .goal-item {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .goal-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .goal-name {
    font-weight: 500;
    color: #216974;
  }

  .goal-progress {
    font-size: 0.875rem;
    color: #666;
  }

  .progress-bar {
    height: 6px;
    background: #f0f0f0;
    border-radius: 3px;
    overflow: hidden;
  }

  .progress {
    height: 100%;
    background: #216974;
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  .verses-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .verse-item {
    padding: 0.75rem;
    background: #f8f8f8;
    border-radius: 8px;
  }

  .verse-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .surah-name {
    font-weight: 500;
    color: #216974;
  }

  .verse-number {
    font-size: 0.875rem;
    color: #666;
  }

  .verse-text {
    margin: 0;
    font-size: 0.875rem;
    color: #333;
    line-height: 1.5;
  }

  .reminders-settings {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .reminder-toggle {
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
  }

  .toggle-slider {
    position: relative;
    width: 40px;
    height: 20px;
    background: #ccc;
    border-radius: 10px;
    transition: 0.3s;
  }

  .toggle-slider:before {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: white;
    top: 2px;
    left: 2px;
    transition: 0.3s;
  }

  input[type="checkbox"] {
    display: none;
  }

  input[type="checkbox"]:checked + .toggle-slider {
    background: #216974;
  }

  input[type="checkbox"]:checked + .toggle-slider:before {
    transform: translateX(20px);
  }

  .sign-out-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    background: none;
    color: #BE9F68;
    padding: 0.75rem;
    border: 1px solid rgba(190, 159, 104, 0.3);
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-top: 1rem;
  }

  .sign-out-button:hover {
    background: rgba(190, 159, 104, 0.1);
  }

  @media (max-width: 480px) {
    .profile-container {
      padding: 0.75rem;
    }

    .profile-image {
      width: 60px;
      height: 60px;
    }

    .user-details h2 {
      font-size: 1.125rem;
    }

    .stat-value {
      font-size: 1.25rem;
    }

    .achievement-icon {
      font-size: 1.25rem;
    }
  }

  .goal-target {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .edit-btn {
    background: none;
    border: none;
    padding: 4px;
    color: #666;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  }

  .edit-btn:hover {
    background: rgba(33, 105, 116, 0.1);
    color: #216974;
  }

  .edit-input {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .edit-input input {
    width: 60px;
    padding: 4px 8px;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    font-size: 0.875rem;
  }

  .save-btn {
    background: #216974;
    color: white;
    border: none;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.75rem;
    cursor: pointer;
  }

  .save-btn:hover {
    opacity: 0.9;
  }

  .toast {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #ef4444;
    color: white;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-size: 0.875rem;
    z-index: 1000;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .time-input {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .time-input input {
    width: 50px;
    padding: 4px 8px;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    font-size: 0.875rem;
  }

  .time-input span {
    color: #666;
    font-size: 0.875rem;
  }
</style> 