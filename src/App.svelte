<script>
  import { onMount } from 'svelte';
  import { auth } from './lib/firebase';
  import SignIn from './lib/pages/SignIn.svelte';
  import Home from './lib/pages/Home.svelte';
  import Notifications from './lib/pages/Notifications.svelte';
  import NotificationIcon from './lib/components/NotificationIcon.svelte';
  import Badges from './lib/pages/Badges.svelte';
  import Profile from './lib/pages/Profile.svelte';
  import Tracker from './lib/pages/Tracker.svelte';
  import Journal from './lib/pages/Journal.svelte';
  import Prayer from './lib/pages/Prayer.svelte';
  import BottomNav from './lib/components/BottomNav.svelte';
  import { ensurePrayerData } from './lib/stores/prayerHistoryStore';
  import Favorites from './lib/pages/Favorites.svelte';
  import { setupNotifications } from './lib/services/notificationService';
  import Onboarding from './lib/components/Onboarding.svelte';
  import { onboardingComplete, checkOnboardingStatus } from './lib/stores/onboardingStore';

  let user = null;
  let activeTab = 'home';
  let showOnboarding = true;

  onMount(() => {
    // Check onboarding status
    checkOnboardingStatus();
    
    // Listen for auth state changes
    const unsubscribe = auth.onAuthStateChanged(async (authUser) => {
      user = authUser; // Set the user variable
      if (user) {
        // Ensure prayer data is initialized when user logs in
        await ensurePrayerData();
      }
    });

    // Subscribe to onboarding status
    const unsubscribeOnboarding = onboardingComplete.subscribe(complete => {
      showOnboarding = !complete;
    });

    return () => {
      unsubscribe();
      unsubscribeOnboarding();
    };
  });

  onMount(async () => {
    try {
      await setupNotifications();
    } catch (error) {
      console.error('Failed to setup notifications:', error);
    }
  });

  function handleTabChange(event) {
    activeTab = event.detail;
  }

  function navigateTo(page) {
    activeTab = page;
  }
</script>

{#if showOnboarding}
  <Onboarding />
{:else if user}
  <div class="top-bar"></div>
  <div class="app-container">
    {#if activeTab !== 'notifications'}
      <NotificationIcon on:click={() => navigateTo('notifications')} />
    {/if}
    
    <main>
      {#if activeTab === 'home'}
        <Home on:navigate={e => navigateTo(e.detail)} />
      {:else if activeTab === 'notifications'}
        <Notifications onBack={() => navigateTo('home')} />
      {:else if activeTab === 'badges'}
        <Badges onBack={() => navigateTo('profile')} />
      {:else if activeTab === 'favorites'}
        <Favorites onBack={() => navigateTo('profile')} />
      {:else if activeTab === 'profile'}
        <Profile {navigateTo} />
      {:else if activeTab === 'tracker'}
        <Tracker />
      {:else if activeTab === 'journal'}
        <Journal />
      {:else if activeTab === 'prayer'}
        <Prayer />
      {:else}
        <Home />
      {/if}
    </main>
    <BottomNav {activeTab} on:tabChange={handleTabChange} />
  </div>
  <div class="bottom-bar"></div>
{:else}
  <main>
    <SignIn />
  </main>
{/if}

<style>
  .top-bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 10px;
    background: white;
    z-index: 99;
  }

  .bottom-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 60px;
    background: white;
    z-index: 99;
  }

  .app-container {
    position: relative;
    width: 100%;
    min-height: 100vh;
    padding-bottom: 80px;
    background: #F8FAFC;
  }

  main {
    width: 100%;
    min-height: 100vh;
    padding-top: 10px;
  }
</style>
