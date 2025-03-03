<script lang="ts">
  import { auth } from '../firebase';
  import { prayerHistoryStore } from '../stores/prayerHistoryStore';
  import { weeklyStatsStore } from '../stores/tasbihStore';
  import { badgeStore } from '../stores/badgeStore';
  import { SignOut, CaretRight, PencilSimple, Camera, Lock } from 'phosphor-svelte';
  import { currentPage } from '../stores/pageStore';
  import { onMount, onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import { getTodayReadingTime } from '../services/readingTimeService';
  import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
  import { signOut } from 'firebase/auth';
  import { subscriptionStore } from '../services/revenuecat';
  import { trialStore, getTrialTimeRemaining, formatTrialTimeRemaining } from '../services/trialService';

  interface StatItem {
    value: () => number | string;
    yesterdayValue?: () => number;
    label: string;
  }

  interface MenuItem {
    title: string;
    description: string;
    path: string;
    stats?: StatItem[];
  }

  // Helper function for type-safe value conversion
  function getNumberValue(value: () => number | string): number {
    const val = value();
    return typeof val === 'number' ? val : 0;
  }

  let user = auth.currentUser;
  let prayerStats = { onTime: 0, late: 0, missed: 0, total: 0 };
  let todayReadingTime = 0;
  let todayDhikrCount = 0;
  let yesterdayPrayerStats = { onTime: 0, late: 0, missed: 0, total: 0 };
  let yesterdayReadingTime = 0;
  let yesterdayDhikrCount = 0;
  let scrollY = 0;
  let earnedBadges = [];
  let isEditingName = false;
  let displayName = localStorage.getItem('user_display_name') || user?.displayName || 'User';
  let profilePicture = '';
  let fileInput: HTMLInputElement;
  let isLoading = true;

  // Calculate prayer statistics when prayerHistoryStore changes
  $: if ($prayerHistoryStore?.history) {
    const allPrayers = $prayerHistoryStore.history;
    const today = new Date().toLocaleDateString('en-CA');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('en-CA');
    
    const onTime = allPrayers.filter(p => p.date === today && p.status === 'ontime').length || 0;
    const late = allPrayers.filter(p => p.date === today && p.status === 'late').length || 0;
    const missed = allPrayers.filter(p => p.date === today && p.status === 'missed').length || 0;
    
    const yesterdayOnTime = allPrayers.filter(p => p.date === yesterdayStr && p.status === 'ontime').length || 0;
    const yesterdayLate = allPrayers.filter(p => p.date === yesterdayStr && p.status === 'late').length || 0;
    const yesterdayMissed = allPrayers.filter(p => p.date === yesterdayStr && p.status === 'missed').length || 0;
    
    prayerStats = {
      onTime,
      late,
      missed,
      total: onTime + late + missed
    };

    yesterdayPrayerStats = {
      onTime: yesterdayOnTime,
      late: yesterdayLate,
      missed: yesterdayMissed,
      total: yesterdayOnTime + yesterdayLate + yesterdayMissed
    };
  }

  // Update today's dhikr count
  $: if ($weeklyStatsStore?.dailyCounts?.length > 0) {
    const today = $weeklyStatsStore.dailyCounts.find(d => d.isToday);
    const yesterday = $weeklyStatsStore.dailyCounts.find(d => {
      const date = new Date();
      date.setDate(date.getDate() - 1);
      const yesterdayStr = date.getDate().toString();
      return d.date.toString() === yesterdayStr;
    });
    todayDhikrCount = today?.count || 0;
    yesterdayDhikrCount = yesterday?.count || 0;
  }

  // Update earned badges when store changes
  $: if ($badgeStore) {
    earnedBadges = badgeStore.getEarnedBadges($badgeStore.earnedBadges);
  }

  // Subscribe to subscription and trial status
  $: isSubscribed = $subscriptionStore?.isSubscribed || false;
  $: isInTrial = $trialStore?.isInTrial || false;
  $: hasTrialEnded = $trialStore?.hasTrialEnded || false;
  $: trialTimeRemaining = getTrialTimeRemaining();

  const menuItems: MenuItem[] = [
    {
      title: 'Your Progress',
      description: 'Track your daily prayers and achievements',
      path: 'progress',
      stats: [
        {
          value: () => prayerStats.onTime,
          yesterdayValue: () => yesterdayPrayerStats.onTime,
          label: 'Prayers on time'
        },
        {
          value: () => Math.floor(todayReadingTime / 60),
          yesterdayValue: () => Math.floor(yesterdayReadingTime / 60),
          label: 'Minutes read'
        },
        {
          value: () => todayDhikrCount,
          yesterdayValue: () => yesterdayDhikrCount,
          label: 'Dhikr today'
        }
      ]
    },
    {
      title: 'Achievements',
      description: 'View your earned badges and milestones',
      path: 'achievements',
      stats: [
        {
          value: () => earnedBadges.length,
          label: 'Badges earned'
        }
      ]
    },
    {
      title: 'Notifications',
      description: 'Manage prayer and journal reminder settings',
      path: 'notifications'
    },
    {
      title: 'Subscription',
      description: isSubscribed 
        ? 'Manage your subscription'
        : isInTrial
          ? `Free trial - ${formatTrialTimeRemaining(trialTimeRemaining)}`
          : hasTrialEnded
            ? 'Free trial ended - Upgrade now'
            : 'Begin Your Spiritual Journey',
      path: 'subscription',
      stats: [
        {
          value: () => isSubscribed 
            ? 'Active' 
            : isInTrial
              ? 'Trial'
              : 'Free',
          label: 'Status'
        }
      ]
    }
  ];

  function handleScroll(event) {
    const container = event.target;
    scrollY = container.scrollTop;
  }

  function handleNameEdit() {
    if (isEditingName) {
      localStorage.setItem('user_display_name', displayName);
    }
    isEditingName = !isEditingName;
  }

  function handleFileSelect(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        profilePicture = (e.target?.result as string) || '';
        localStorage.setItem('user_profile_picture', profilePicture);
      };
      reader.readAsDataURL(file);
    }
  }

  export let navigateTo: (path: string) => void;

  // Initialize data
  async function initializeData() {
    todayReadingTime = await getTodayReadingTime();
    
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const yesterdayEnd = new Date(yesterday);
      yesterdayEnd.setHours(23, 59, 59, 999);

      const db = getFirestore();
      const readingSessionsRef = collection(db, 'reading_sessions');
      const q = query(
        readingSessionsRef,
        where('userId', '==', user?.uid),
        where('startTime', '>=', yesterday.toISOString()),
        where('startTime', '<=', yesterdayEnd.toISOString())
      );
      
      const querySnapshot = await getDocs(q);
      let totalSeconds = 0;

      querySnapshot.forEach((doc) => {
        const session = doc.data();
        if (session.duration) {
          totalSeconds += session.duration;
        }
      });

      yesterdayReadingTime = totalSeconds;
    } catch (error) {
      console.error('Error fetching yesterday\'s reading time:', error);
      yesterdayReadingTime = 0;
    }
  }

  onMount(() => {
    // Get the stored profile picture or user's photoURL
    profilePicture = localStorage.getItem('user_profile_picture') || user?.photoURL || '';

    const container = document.querySelector('.profile-container');
    if (container) {
      container.addEventListener('scroll', handleScroll);
    }

    // Initialize reading time
    initializeData().catch(console.error);

    // Initialize badge store
    if (user?.uid) {
      badgeStore.init(user.uid);
    }

    const unsubscribe = auth.onAuthStateChanged((authUser) => {
      user = authUser;
      isLoading = false;
    });

    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
      unsubscribe();
    };
  });

  async function handleLogout() {
    try {
      await signOut(auth);
      currentPage.set('home');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  }
</script>

<div class="profile-container" class:scrolled={scrollY > 10} on:scroll={handleScroll}>
  <div class="profile-header" transition:fade>
    <div class="avatar">
      <input
        type="file"
        accept="image/*"
        bind:this={fileInput}
        on:change={handleFileSelect}
        style="display: none"
      />
      {#if profilePicture}
        <img src={profilePicture} alt="Profile" />
      {:else}
        <div class="avatar-placeholder">
          {user?.email?.[0]?.toUpperCase() || '?'}
        </div>
      {/if}
    </div>
    <button class="upload-button" on:click={() => fileInput.click()}>
      Change photo
    </button>

    <div class="name-container">
      {#if isEditingName}
        <input
          type="text"
          bind:value={displayName}
          class="name-input"
          on:blur={handleNameEdit}
          on:keydown={(e) => e.key === 'Enter' && handleNameEdit()}
        />
      {:else}
        <h1>{displayName}</h1>
        <button class="edit-name" on:click={handleNameEdit}>
          <PencilSimple weight="bold" />
        </button>
      {/if}
    </div>
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
                  <div class="stat-header">
                    <span class="stat-value">{stat.value()}</span>
                    {#if stat.yesterdayValue && typeof stat.value() === 'number'}
                      {@const currentValue = getNumberValue(stat.value)}
                      {@const yesterdayValue = stat.yesterdayValue()}
                      <span class="stat-change {currentValue > yesterdayValue ? 'positive' : currentValue < yesterdayValue ? 'negative' : ''}">
                        {#if currentValue > yesterdayValue}
                          +{currentValue - yesterdayValue}
                        {:else if currentValue < yesterdayValue}
                          {currentValue - yesterdayValue}
                        {/if}
                      </span>
                    {/if}
                  </div>
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
    margin: 0 auto 0.5rem;
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

  .stat-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .stat-value {
    font-size: 1.25rem;
    font-weight: 600;
    color: #216974;
  }

  .stat-change {
    font-size: 0.875rem;
    font-weight: 500;
  }

  .stat-change.positive {
    color: #22c55e;
  }

  .stat-change.negative {
    color: #ef4444;
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

  .edit-avatar {
    position: absolute;
    bottom: 0;
    right: 0;
    background: #216974;
    border: none;
    border-radius: 50%;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .edit-avatar:hover {
    background: #184f57;
  }

  .name-container {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .edit-name {
    background: none;
    border: none;
    padding: 4px;
    color: #6c757d;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s;
  }

  .edit-name:hover {
    color: #216974;
  }

  .name-input {
    font-size: 1.5rem;
    font-weight: 600;
    text-align: center;
    border: none;
    border-bottom: 2px solid #216974;
    background: transparent;
    color: #212529;
    padding: 0.25rem;
    width: auto;
    min-width: 150px;
  }

  .name-input:focus {
    outline: none;
  }

  .upload-button {
    background: none;
    border: none;
    color: #216974;
    font-size: 0.875rem;
    padding: 4px 8px;
    cursor: pointer;
    margin-bottom: 1rem;
    transition: color 0.2s;
  }

  .upload-button:hover {
    color: #184f57;
  }
</style> 