<script>
  import { auth } from '../firebase';
  import { prayerHistoryStore } from '../stores/prayerHistoryStore';
  import { weeklyStatsStore } from '../stores/tasbihStore';
  import { badgeStore } from '../stores/badgeStore';
  import { SignOut, CaretRight } from 'phosphor-svelte';
  import { currentPage } from '../stores/pageStore';
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { getTodayReadingTime } from '../services/readingTimeService';

  const user = auth.currentUser;
  let prayerStats = { onTime: 0, late: 0, missed: 0, total: 0 };
  let todayReadingTime = 0;
  let todayDhikrCount = 0;
  let scrollY = 0;
  let earnedBadges = [];

  // Calculate prayer statistics when prayerHistoryStore changes
  $: if ($prayerHistoryStore?.history) {
    const allPrayers = $prayerHistoryStore.history;
    const today = new Date().toLocaleDateString('en-CA');
    
    const onTime = allPrayers.filter(p => p.status === 'ontime').length || 0;
    const late = allPrayers.filter(p => p.status === 'late').length || 0;
    const missed = allPrayers.filter(p => p.status === 'missed').length || 0;
    
    prayerStats = {
      onTime,
      late,
      missed,
      total: onTime + late + missed
    };
  }

  // Update today's dhikr count
  $: if ($weeklyStatsStore?.dailyCounts?.length > 0) {
    const today = $weeklyStatsStore.dailyCounts.find(d => d.isToday);
    todayDhikrCount = today?.count || 0;
  }

  // Update earned badges when store changes
  $: if ($badgeStore) {
    earnedBadges = badgeStore.getEarnedBadges($badgeStore.earnedBadges);
  }

  const menuItems = [
    {
      title: 'Your Progress',
      description: 'Track your daily prayers and achievements',
      path: '/progress',
      stats: [
        {
          value: () => prayerStats.onTime,
          label: 'Prayers on time'
        },
        {
          value: () => Math.floor(todayReadingTime / 60),
          label: 'Minutes read'
        },
        {
          value: () => todayDhikrCount,
          label: 'Dhikr today'
        }
      ]
    },
    {
      title: 'Achievements',
      description: 'View your earned badges and milestones',
      path: '/achievements',
      stats: [
        {
          value: () => earnedBadges.length,
          label: 'Badges earned'
        }
      ]
    },
    {
      title: 'Settings',
      description: 'Customize your app preferences',
      path: '/settings'
    },
    {
      title: 'Notifications',
      description: 'Manage your prayer and reminder alerts',
      path: '/notifications'
    }
  ];

  function handleScroll(event) {
    const container = event.target;
    scrollY = container.scrollTop;
  }

  function navigateTo(path) {
    currentPage.set(path.substring(1)); // Remove the leading slash
  }

  onMount(async () => {
    const container = document.querySelector('.profile-container');
    if (container) {
      container.addEventListener('scroll', handleScroll);
    }

    // Initialize badge store
    if (user?.uid) {
      badgeStore.init(user.uid);
    }

    // Initialize async operations
    todayReadingTime = await getTodayReadingTime();

    return () => {
      container?.removeEventListener('scroll', handleScroll);
    };
  });

  async function handleLogout() {
    try {
      await auth.signOut();
      currentPage.set('home');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  }
</script>

<div class="profile-container" class:scrolled={scrollY > 10} on:scroll={handleScroll}>
  <div class="profile-header" transition:fade>
    <div class="avatar">
      {#if user?.photoURL}
        <img src={user.photoURL} alt="Profile" />
      {:else}
        <div class="avatar-placeholder">
          {user?.displayName?.[0] || user?.email?.[0] || '?'}
        </div>
      {/if}
    </div>
    <h1>{user?.displayName || 'User'}</h1>
    <p class="location">{user?.email || ''}</p>
  </div>

  <div class="menu-container">
    {#each menuItems as item}
      <button class="menu-item" on:click={() => navigateTo(item.path)}>
        <div class="menu-content">
          <h2>{item.title}</h2>
          <p>{item.description}</p>
          {#if item.stats}
            <div class="stats-row">
              {#each item.stats as stat}
                <div class="stat-item">
                  <span class="stat-value">{stat.value()}</span>
                  <span class="stat-label">{stat.label}</span>
                </div>
              {/each}
            </div>
          {/if}
        </div>
        <CaretRight weight="bold" />
      </button>
    {/each}

    <button class="menu-item sign-out" on:click={handleLogout}>
      <div class="menu-content">
        <h2>Sign Out</h2>
        <p>Log out of your account</p>
      </div>
      <SignOut weight="bold" />
    </button>
  </div>
</div>

<style>
  .profile-container {
    height: 100%;
    overflow-y: auto;
    background-color: #f8f9fa;
    padding: 0;
    position: relative;
  }

  .profile-header {
    padding: 2rem 1.5rem;
    text-align: center;
    background: white;
    margin-bottom: 1rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .avatar {
    width: 100px;
    height: 100px;
    margin: 0 auto 1rem;
    border-radius: 50%;
    overflow: hidden;
    background: #e9ecef;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .avatar-placeholder {
    font-size: 2.5rem;
    color: #6c757d;
    text-transform: uppercase;
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0;
    color: #212529;
  }

  .location {
    color: #6c757d;
    margin: 0.5rem 0 0;
    font-size: 0.9rem;
  }

  .menu-container {
    padding: 1rem;
  }

  .menu-item {
    width: 100%;
    background: white;
    border: none;
    border-radius: 12px;
    padding: 1rem;
    margin-bottom: 1rem;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    text-align: left;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .menu-item:active {
    transform: scale(0.98);
  }

  .menu-content {
    flex: 1;
  }

  .menu-item h2 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: #212529;
  }

  .menu-item p {
    margin: 0.25rem 0 0;
    font-size: 0.9rem;
    color: #6c757d;
  }

  .stats-row {
    display: flex;
    gap: 1rem;
    margin-top: 1rem;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(0, 0, 0, 0.05);
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .stat-value {
    font-size: 1.25rem;
    font-weight: 600;
    color: #216974;
  }

  .stat-label {
    font-size: 0.75rem;
    color: #6c757d;
  }

  .scrolled .profile-header {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .sign-out {
    margin-top: 2rem;
    background: rgba(239, 68, 68, 0.05);
    border: 1px solid rgba(239, 68, 68, 0.2);
  }

  .sign-out h2 {
    color: #ef4444;
  }

  .sign-out :global(svg) {
    color: #ef4444;
  }
</style> 