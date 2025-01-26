<script>
  import { badgeStore } from '../stores/badgeStore';
  import { ArrowLeft, Trophy, Mosque, Book, HandsPraying, Sun, BookBookmark, Sparkle, Pencil, CalendarPlus } from 'phosphor-svelte';
  import { onMount } from 'svelte';

  let earnedBadges = [];
  let allBadges = badgeStore.getAllBadges();
  let selectedCategory = 'all';

  export let onBack;

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

  function goBack() {
    onBack();
  }

  const categories = [
    { id: 'all', name: 'All Badges' },
    { id: 'prayer', name: 'Prayer' },
    { id: 'quran', name: 'Quran' },
    { id: 'dhikr', name: 'Dhikr' },
    { id: 'journal', name: 'Journal' }
  ];

  $: filteredBadges = selectedCategory === 'all' 
    ? Object.values(allBadges).flatMap(category => Object.values(category).flat())
    : Object.values(allBadges[selectedCategory] || {}).flat();

  $: inProgressBadges = filteredBadges.filter(badge => {
    const progress = getBadgeProgress(badge);
    return progress > 0 && progress < 100 && !earnedBadges.some(eb => eb.id === badge.id);
  });

  $: earnedFilteredBadges = filteredBadges.filter(badge => 
    earnedBadges.some(eb => eb.id === badge.id)
  );

  $: lockedBadges = filteredBadges.filter(badge => 
    !earnedBadges.some(eb => eb.id === badge.id) && 
    !inProgressBadges.some(pb => pb.id === badge.id)
  );
</script>

<div class="achievements-page">
  <header>
    <button class="back-button" on:click={goBack}>
      <ArrowLeft weight="bold" />
    </button>
    <h1>Achievements</h1>
  </header>

  <div class="stats-overview">
    <div class="stat-card">
      <div class="stat-icon">
        <Trophy weight="fill" />
      </div>
      <div class="stat-content">
        <span class="stat-value">{earnedBadges.length}</span>
        <span class="stat-label">Badges earned</span>
      </div>
    </div>
  </div>

  <div class="category-tabs">
    {#each categories as category}
      <button 
        class="tab-button" 
        class:active={selectedCategory === category.id}
        on:click={() => selectedCategory = category.id}
      >
        {category.name}
      </button>
    {/each}
  </div>

  {#if inProgressBadges.length > 0}
    <section class="badge-section">
      <h2>In Progress</h2>
      <div class="badges-grid">
        {#each inProgressBadges as badge}
          <div class="badge-card in-progress">
            <div class="badge-icon" data-level={badge.level}>
              <svelte:component this={getBadgeIcon(badge)} size={24} weight="fill" />
            </div>
            <div class="badge-info">
              <h3>{badge.name}</h3>
              <p>{badge.description}</p>
              <div class="progress-bar">
                <div class="progress" style="width: {getBadgeProgress(badge)}%"></div>
              </div>
              <span class="progress-text">{Math.round(getBadgeProgress(badge))}%</span>
            </div>
          </div>
        {/each}
      </div>
    </section>
  {/if}

  {#if earnedFilteredBadges.length > 0}
    <section class="badge-section">
      <h2>Earned</h2>
      <div class="badges-grid">
        {#each earnedFilteredBadges as badge}
          <div class="badge-card earned">
            <div class="badge-icon" data-level={badge.level}>
              <svelte:component this={getBadgeIcon(badge)} size={24} weight="fill" />
            </div>
            <div class="badge-info">
              <h3>{badge.name}</h3>
              <p>{badge.description}</p>
            </div>
          </div>
        {/each}
      </div>
    </section>
  {/if}

  {#if lockedBadges.length > 0}
    <section class="badge-section">
      <h2>Locked</h2>
      <div class="badges-grid">
        {#each lockedBadges as badge}
          <div class="badge-card locked">
            <div class="badge-icon" data-level={badge.level}>
              <svelte:component this={getBadgeIcon(badge)} size={24} weight="fill" />
            </div>
            <div class="badge-info">
              <h3>{badge.name}</h3>
              <p>{badge.description}</p>
            </div>
          </div>
        {/each}
      </div>
    </section>
  {/if}
</div>

<style>
  .achievements-page {
    height: 100%;
    background: #f8f9fa;
    padding: 1rem;
    overflow-y: auto;
  }

  header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .back-button {
    background: none;
    border: none;
    color: #216974;
    padding: 0.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
  }

  .back-button:hover {
    background: rgba(33, 105, 116, 0.1);
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #212529;
    margin: 0;
  }

  .stats-overview {
    margin-bottom: 2rem;
  }

  .stat-card {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .stat-icon {
    width: 48px;
    height: 48px;
    border-radius: 24px;
    background: #216974;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
  }

  .stat-content {
    flex: 1;
  }

  .stat-value {
    display: block;
    font-size: 1.5rem;
    font-weight: 600;
    color: #212529;
  }

  .stat-label {
    font-size: 0.875rem;
    color: #6c757d;
  }

  .category-tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 2rem;
    overflow-x: auto;
    padding-bottom: 0.5rem;
  }

  .tab-button {
    background: none;
    border: none;
    padding: 0.5rem 1rem;
    color: #6c757d;
    font-weight: 500;
    cursor: pointer;
    border-radius: 20px;
    white-space: nowrap;
  }

  .tab-button.active {
    background: #216974;
    color: white;
  }

  .badge-section {
    margin-bottom: 2rem;
  }

  .badge-section h2 {
    font-size: 1.1rem;
    font-weight: 600;
    color: #212529;
    margin: 0 0 1rem 0;
  }

  .badges-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }

  .badge-card {
    background: white;
    border-radius: 12px;
    padding: 1rem;
    display: flex;
    gap: 1rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .badge-icon {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    background: #f8f9fa;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #216974;
    position: relative;
    flex-shrink: 0;
  }

  .badge-icon::after {
    content: attr(data-level);
    position: absolute;
    bottom: -4px;
    right: -4px;
    background: #E09453;
    color: white;
    font-size: 0.75rem;
    font-weight: 600;
    min-width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    padding: 0 4px;
  }

  .badge-info {
    flex: 1;
  }

  .badge-info h3 {
    font-size: 1rem;
    font-weight: 600;
    color: #212529;
    margin: 0 0 0.25rem 0;
  }

  .badge-info p {
    font-size: 0.875rem;
    color: #6c757d;
    margin: 0;
  }

  .progress-bar {
    height: 4px;
    background: #f8f9fa;
    border-radius: 2px;
    margin-top: 0.75rem;
    overflow: hidden;
  }

  .progress {
    height: 100%;
    background: #216974;
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .progress-text {
    display: block;
    font-size: 0.75rem;
    color: #6c757d;
    margin-top: 0.25rem;
  }

  .badge-card.locked {
    opacity: 0.5;
  }

  .badge-card.earned .badge-icon {
    background: #216974;
    color: white;
  }

  @media (max-width: 480px) {
    .badges-grid {
      grid-template-columns: 1fr;
    }
  }
</style> 