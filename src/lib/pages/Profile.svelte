<script>
  import { auth } from '../firebase';
  import { prayerHistoryStore } from '../stores/prayerHistoryStore';
  import { weeklyStatsStore } from '../stores/tasbihStore';
  import { badgeStore } from '../stores/badgeStore';
  import { Bell, Trophy, Target, Book, ChartBar, SignOut, CaretRight } from 'phosphor-svelte';
  import Toast from '../components/Toast.svelte';
  import { currentPage } from '../stores/pageStore';
  
  const user = auth.currentUser;
  let prayerStats = { onTime: 0, late: 0, missed: 0, total: 0 };
  let earnedBadges = [];
  let allBadges = badgeStore.getAllBadges();
  let activeTab = 'profile';
  
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
    prayerStats = {
      total: $prayerHistoryStore.history.length || 0,
      onTime: $prayerHistoryStore.history.filter(p => p.status === 'ontime').length || 0,
      late: $prayerHistoryStore.history.filter(p => p.status === 'late').length || 0,
      missed: $prayerHistoryStore.history.filter(p => p.status === 'missed').length || 0
    };
  }

  // Goals data
  $: goals = [
    { name: 'Daily Prayers', target: 5, current: prayerStats.onTime },
    { name: 'Quran Reading', target: 30, current: $badgeStore?.progress?.['daily_reading'] || 0, unit: 'minutes' },
    { name: 'Dhikr Count', target: 100, current: $weeklyStatsStore?.dailyCounts?.[0]?.count || 0 }
  ];

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
</script>

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
    <div class="card">
      <div class="card-header">
        <h3><Trophy weight="fill" /> Achievement Badges</h3>
        <div class="badge-stats">
          <span>{earnedBadgesCount}/{getTotalBadgesCount()}</span>
        </div>
      </div>
      <div class="badges-container">
        {#each Object.keys(allBadges) as category}
          {@const badge = getFirstBadgeFromCategory(category)}
          <div class="badge-item {badge.unlocked ? 'unlocked' : ''}">
            <div class="badge-icon">{badge.image}</div>
            <div class="badge-details">
              <span class="badge-name">{badge.name}</span>
              <span class="badge-description">{badge.description}</span>
              {#if !badge.unlocked}
                <div class="badge-progress">
                  <div class="progress-bar">
                    <div 
                      class="progress" 
                      style="width: {getBadgeProgress(badge)}%"
                    ></div>
                  </div>
                  <span class="progress-text">{Math.round(getBadgeProgress(badge))}%</span>
                </div>
              {/if}
            </div>
          </div>
        {/each}
        <button class="view-all-button" on:click={() => navigateTo('badges')}>
          <span>View All Badges</span>
          <CaretRight weight="bold" />
        </button>
      </div>
    </div>

    <!-- Personal Goals Card -->
    <div class="card">
      <h3><Target weight="fill" /> Personal Goals</h3>
      <div class="goals-list">
        {#each goals as goal}
          <div class="goal-item">
            <div class="goal-info">
              <span class="goal-name">{goal.name}</span>
              <span class="goal-progress">{goal.current}/{goal.target} {goal.unit || ''}</span>
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

  .badges-container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .badge-item {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1rem;
    border-radius: 8px;
    background: #f8f8f8;
    opacity: 0.6;
    transition: all 0.2s ease;
    border: 1px solid rgba(33, 105, 116, 0.1);
  }

  .badge-item.unlocked {
    opacity: 1;
    background: rgba(33, 105, 116, 0.1);
    border-color: rgba(33, 105, 116, 0.3);
  }

  .badge-icon {
    font-size: 1.5rem;
    width: 2.5rem;
    height: 2.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(33, 105, 116, 0.05);
    border-radius: 50%;
    flex-shrink: 0;
  }

  .badge-item.unlocked .badge-icon {
    background: #216974;
    color: white;
  }

  .badge-details {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .badge-name {
    font-weight: 500;
    color: #216974;
  }

  .badge-description {
    font-size: 0.75rem;
    color: #666;
    margin-top: 0.25rem;
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
    background-color: #dc3545;
    color: white;
    padding: 1rem;
    border: none;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
    margin-top: 1rem;
  }

  .sign-out-button:hover {
    background-color: #c82333;
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

  .badge-progress {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .badge-progress .progress-bar {
    flex: 1;
    height: 4px;
    background: rgba(33, 105, 116, 0.1);
    border-radius: 2px;
    overflow: hidden;
  }

  .badge-progress .progress {
    height: 100%;
    background: #216974;
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .progress-text {
    font-size: 0.75rem;
    color: #216974;
    min-width: 2.5rem;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .badge-stats {
    font-size: 0.875rem;
    color: #216974;
    font-weight: 500;
    background: rgba(33, 105, 116, 0.1);
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
  }

  .view-all-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    background: #216974;
    color: white;
    border: none;
    padding: 0.75rem;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s ease;
    margin-top: 0.5rem;
  }

  .view-all-button:hover {
    background: #184f57;
  }

  .view-all-button :global(svg) {
    transition: transform 0.2s ease;
  }

  .view-all-button:hover :global(svg) {
    transform: translateX(4px);
  }
</style> 