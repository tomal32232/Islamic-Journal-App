<script>
  import { onMount } from 'svelte';
  import { badgeStore } from '../stores/badgeStore';
  import { 
    Trophy, 
    ArrowLeft, 
    Mosque, 
    Sun, 
    Book, 
    BookBookmark, 
    Star, 
    Pencil, 
    CalendarPlus, 
    Heart 
  } from 'phosphor-svelte';
  import { auth } from '../firebase';

  export let onBack;

  let earnedBadges = [];
  let allBadges = badgeStore.getAllBadges();
  let selectedCategory = 'all';
  let searchQuery = '';
  let filterUnlocked = 'all'; // 'all', 'unlocked', 'locked'

  onMount(() => {
    console.log('=== Badges Component Mounted ===');
    const user = auth.currentUser;
    if (user) {
      console.log('Initializing badge store for user:', user.uid);
      badgeStore.init(user.uid);
    } else {
      console.log('No user found');
    }
  });

  // Update earned badges when store changes
  $: if ($badgeStore) {
    console.log('Badge store updated:', $badgeStore);
    earnedBadges = badgeStore.getEarnedBadges($badgeStore.earnedBadges);
  }

  // Calculate badge progress
  function getBadgeProgress(badge) {
    console.log('=== Getting Badge Progress ===');
    console.log('Badge:', badge);
    console.log('Badge Store:', $badgeStore);
    
    if (!$badgeStore?.progress) {
      console.log('No progress data in badge store');
      return 0;
    }
    
    const progress = $badgeStore.progress;
    let current = 0;
    let target = 0;

    // Get the base progress key without the _progress suffix
    const progressKey = badge.requirement.type;
    const progressKeyWithSuffix = `${progressKey}_progress`;
    console.log('Progress key:', progressKey);
    console.log('Progress key with suffix:', progressKeyWithSuffix);
    console.log('All progress keys:', Object.keys(progress));

    switch (badge.requirement.type) {
      case 'streak':
        current = progress['streak'] || progress['streak_progress'] || 0;
        target = badge.requirement.count;
        break;
      case 'ontime_fajr':
        current = progress['ontime_fajr'] || progress['ontime_fajr_progress'] || 0;
        target = badge.requirement.count;
        break;
      case 'daily_reading':
        current = progress['daily_reading'] || progress['daily_reading_progress'] || 0;
        target = badge.requirement.minutes;
        break;
      case 'juz_completion':
        current = progress['juz_completion'] || progress['juz_completion_progress'] || 0;
        target = badge.requirement.count;
        break;
      case 'daily_dhikr':
        current = progress['daily_dhikr'] || progress['daily_dhikr_progress'] || 0;
        target = badge.requirement.count;
        break;
      case 'dhikr_streak':
        current = progress['dhikr_streak'] || progress['dhikr_streak_progress'] || 0;
        target = badge.requirement.days;
        break;
      case 'journal_entries':
        current = progress['journal_entries'] || progress['journal_entries_progress'] || 0;
        target = badge.requirement.count;
        break;
      case 'journal_streak':
        current = progress['journal_streak'] || progress['journal_streak_progress'] || 0;
        target = badge.requirement.days;
        break;
    }

    console.log('Current value:', current);
    console.log('Target value:', target);
    const percentage = Math.min((current / target) * 100, 100);
    console.log('Calculated percentage:', percentage);
    
    return percentage;
  }

  // Filter badges based on search, category, and unlock status
  $: filteredBadges = Object.entries(allBadges).reduce((acc, [category, categoryBadges]) => {
    if (selectedCategory !== 'all' && selectedCategory !== category) {
      return acc;
    }

    const badges = Object.values(categoryBadges).flat().map(badge => ({
      ...badge,
      unlocked: earnedBadges.some(eb => eb.id === badge.id)
    }));

    const filtered = badges.filter(badge => {
      const matchesSearch = searchQuery === '' || 
        badge.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        badge.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFilter = filterUnlocked === 'all' || 
        (filterUnlocked === 'unlocked' && badge.unlocked) ||
        (filterUnlocked === 'locked' && !badge.unlocked);

      return matchesSearch && matchesFilter;
    });

    if (filtered.length > 0) {
      acc[category] = filtered;
    }

    return acc;
  }, {});

  // Get total and earned counts
  $: totalBadges = Object.values(allBadges).reduce((total, category) => {
    return total + Object.values(category).reduce((sum, badges) => sum + badges.length, 0);
  }, 0);
  $: earnedCount = earnedBadges.length;
</script>

<div class="badges-page">
  <header class="badges-header">
    <button class="back-button" on:click={onBack}>
      <ArrowLeft weight="bold" />
      <span>Back to Profile</span>
    </button>
    <div class="header-content">
      <h1>
        <Trophy weight="fill" />
        Achievements
      </h1>
      <div class="badge-stats">
        <span>{earnedCount}/{totalBadges}</span>
        <span class="stats-label">Badges Earned</span>
      </div>
    </div>
  </header>

  <div class="filters">
    <div class="search-box">
      <input 
        type="text" 
        placeholder="Search badges..." 
        bind:value={searchQuery}
      >
    </div>
    <div class="filter-options">
      <select bind:value={selectedCategory}>
        <option value="all">All Categories</option>
        {#each Object.keys(allBadges) as category}
          <option value={category}>
            {category.charAt(0).toUpperCase() + category.slice(1)}
          </option>
        {/each}
      </select>
      <select bind:value={filterUnlocked}>
        <option value="all">All Badges</option>
        <option value="unlocked">Unlocked</option>
        <option value="locked">Locked</option>
      </select>
    </div>
  </div>

  <div class="badges-content">
    {#each Object.entries(filteredBadges) as [category, badges]}
      <section class="category-section">
        <h2>{category.charAt(0).toUpperCase() + category.slice(1)}</h2>
        <div class="badges-grid">
          {#each badges as badge}
            <div class="badge-item {badge.unlocked ? 'unlocked' : ''}">
              <div class="badge-icon" data-level={badge.level}>
                {#if badge.category === 'prayer' && badge.requirement.type === 'streak'}
                  <Mosque size={20} weight="fill" />
                {:else if badge.category === 'prayer' && badge.requirement.type === 'ontime_fajr'}
                  <Sun size={20} weight="fill" />
                {:else if badge.category === 'quran' && badge.requirement.type === 'daily_reading'}
                  <Book size={20} weight="fill" />
                {:else if badge.category === 'quran' && badge.requirement.type === 'juz_completion'}
                  <BookBookmark size={20} weight="fill" />
                {:else if badge.category === 'dhikr' && badge.requirement.type === 'daily_dhikr'}
                  <Heart size={20} weight="fill" />
                {:else if badge.category === 'dhikr' && badge.requirement.type === 'dhikr_streak'}
                  <Star size={20} weight="fill" />
                {:else if badge.category === 'journal' && badge.requirement.type === 'journal_entries'}
                  <Pencil size={20} weight="fill" />
                {:else if badge.category === 'journal' && badge.requirement.type === 'journal_streak'}
                  <CalendarPlus size={20} weight="fill" />
                {/if}
              </div>
              <div class="badge-details">
                <div class="badge-header">
                  <span class="badge-name">{badge.name}</span>
                  {#if !badge.unlocked}
                    <span class="progress-text">{Math.round(getBadgeProgress(badge))}%</span>
                  {/if}
                </div>
                <span class="badge-description">{badge.description}</span>
                {#if !badge.unlocked}
                  <div class="progress-bar">
                    <div 
                      class="progress" 
                      style="width: {getBadgeProgress(badge)}%"
                    ></div>
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </section>
    {/each}
  </div>
</div>

<style>
  .badges-page {
    padding: 1rem;
    padding-bottom: 64px;
    background: #F8FAFC;
    min-height: 100vh;
  }

  .badges-header {
    margin-bottom: 1rem;
  }

  .back-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: none;
    border: none;
    color: #216974;
    padding: 0;
    margin-bottom: 0.5rem;
    cursor: pointer;
    font-weight: 500;
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  h1 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    color: #216974;
    font-size: 1.25rem;
  }

  h2 {
    color: #216974;
    font-size: 1rem;
    margin: 0 0 0.5rem 0;
    font-weight: 500;
  }

  .badge-stats {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  .badge-stats span {
    font-size: 1rem;
    font-weight: 600;
    color: #216974;
  }

  .stats-label {
    font-size: 0.75rem !important;
    font-weight: normal !important;
    opacity: 0.8;
  }

  .filters {
    margin-bottom: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .search-box input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid rgba(33, 105, 116, 0.2);
    border-radius: 6px;
    font-size: 0.875rem;
    color: #216974;
  }

  .filter-options {
    display: flex;
    gap: 0.5rem;
  }

  .filter-options select {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid rgba(33, 105, 116, 0.2);
    border-radius: 6px;
    font-size: 0.875rem;
    color: #216974;
    background: white;
  }

  .category-section {
    margin-bottom: 1rem;
  }

  .badges-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 0.5rem;
  }

  .badge-item {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem;
    border-radius: 6px;
    background: white;
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
    font-size: 1rem;
    width: 2.25rem;
    height: 2.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: white;
    border: 1px solid rgba(33, 105, 116, 0.2);
    color: #216974;
    border-radius: 4px;
    flex-shrink: 0;
    position: relative;
  }

  .badge-icon :global(svg) {
    width: 20px;
    height: 20px;
  }

  .badge-item.unlocked .badge-icon {
    background: #216974;
    color: white;
    border: none;
  }

  .badge-icon::after {
    content: attr(data-level);
    position: absolute;
    bottom: -2px;
    right: -2px;
    background: #216974;
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

  .badge-item.unlocked .badge-icon::after {
    background: white;
    color: #216974;
    border: 1px solid #216974;
  }

  .badge-details {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding-top: 0.25rem;
  }

  .badge-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .badge-name {
    font-weight: 500;
    color: #216974;
    font-size: 0.875rem;
  }

  .badge-description {
    font-size: 0.75rem;
    color: #666;
  }

  .progress-bar {
    height: 3px;
    background: rgba(33, 105, 116, 0.1);
    border-radius: 1.5px;
    overflow: hidden;
    margin-top: 0.25rem;
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
  }

  @media (max-width: 640px) {
    .filter-options {
      flex-direction: column;
    }

    .badges-grid {
      grid-template-columns: 1fr;
    }
  }
</style> 