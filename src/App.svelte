<script>
  import { onMount } from 'svelte';
  import { auth } from './lib/firebase';
  import SignIn from './lib/pages/SignIn.svelte';
  import Home from './lib/pages/Home.svelte';
  import Notifications from './lib/pages/Notifications.svelte';
  import NotificationIcon from './lib/components/NotificationIcon.svelte';
  import Notification from './lib/components/Notification.svelte';
  import Badges from './lib/pages/Badges.svelte';
  import Profile from './lib/pages/Profile.svelte';
  import Tracker from './lib/pages/Tracker.svelte';
  import Journal from './lib/pages/Journal.svelte';
  import Prayer from './lib/pages/Prayer.svelte';
  import Progress from './lib/pages/Progress.svelte';
  import Achievements from './lib/pages/Achievements.svelte';
  import BottomNav from './lib/components/BottomNav.svelte';
  import { ensurePrayerData } from './lib/stores/prayerHistoryStore';
  import Favorites from './lib/pages/Favorites.svelte';
  import { setupNotifications, navigationStore } from './lib/services/notificationService';
  import Onboarding from './lib/components/Onboarding.svelte';
  import { onboardingComplete, checkOnboardingStatus } from './lib/stores/onboardingStore';
  import QuranReading from './lib/components/QuranReading.svelte';
  import Tasbih from './lib/pages/Tasbih.svelte';
  import { initializeRevenueCat, subscriptionStore } from './lib/services/revenuecat';
  import Subscription from './lib/pages/Subscription.svelte';
  import WelcomePopup from './lib/components/WelcomePopup.svelte';
  import { trialStore, initializeTrialStatus } from './lib/services/trialService';
  import { getFirestore, doc, getDoc } from 'firebase/firestore';
  import { startTrial } from './lib/services/trialService';
  import { achievementStore } from './lib/stores/achievementStore';
  import { onAuthStateChanged } from 'firebase/auth';
  import { badgeStore } from './lib/stores/badgeStore';

  let user = null;
  let activeTab = 'home';
  let showOnboarding = true;
  let isLoading = true;
  let showWelcomePopup = false;
  let initializationError = null;
  
  // Debug mode - set to false to enable normal initialization
  const DEBUG_MODE = false;
  const INITIALIZATION_TIMEOUT = 15000; // 15 seconds timeout

  // Subscribe to subscription and trial status
  $: isSubscribed = $subscriptionStore?.isSubscribed || false;
  $: isInTrial = $trialStore?.isInTrial || false;
  $: hasTrialEnded = $trialStore?.hasTrialEnded || false;

  // Force subscription page when trial ends and not subscribed
  $: if (hasTrialEnded && !isSubscribed && activeTab !== 'subscription') {
    activeTab = 'subscription';
  }

  onMount(() => {
    // Set a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.log('Initialization timeout reached, forcing app to load');
      isLoading = false;
      initializationError = 'Initialization timed out';
    }, INITIALIZATION_TIMEOUT);
    
    // Skip initialization in debug mode, but still check onboarding status
    if (DEBUG_MODE) {
      console.log('DEBUG MODE: Skipping initialization steps');
      checkOnboardingStatus();
      isLoading = false;
      clearTimeout(timeoutId);
      return;
    }
    
    // Initialize RevenueCat
    initializeRevenueCat().catch(error => {
      console.error('Failed to initialize RevenueCat:', error);
    });

    // Check onboarding status
    checkOnboardingStatus();
    
    // Listen for auth state changes
    const unsubscribe = auth.onAuthStateChanged(async (authUser) => {
      const isNewLogin = !user && authUser;
      user = authUser;
      
      if (user) {
        try {
          console.log('User authenticated:', user.uid);
          
          // Initialize badge and achievement tracking first
          console.log('Initializing badge and achievement tracking...');
          badgeStore.init(user.uid);
          achievementStore.init(user.uid);

          // Initialize trial status and start trial if not exists
          const db = getFirestore();
          const trialRef = doc(db, 'trials', user.uid);
          console.log('Checking trial document:', trialRef.path);
          const trialDoc = await getDoc(trialRef);
          
          if (!trialDoc.exists()) {
            console.log('No trial found, starting new trial for user:', user.uid);
            await startTrial(user.uid);
          } else {
            console.log('Existing trial found:', trialDoc.data());
            await initializeTrialStatus(user.uid);
          }
          
          // Show welcome popup for new login
          if (isNewLogin) {
            console.log('New login detected, showing welcome popup');
            showWelcomePopup = true;
          }
          
          // Ensure prayer data is initialized
          await ensurePrayerData();
        } catch (error) {
          console.error('Error during initialization:', error);
          initializationError = error.message;
        }
      } else {
        // Cleanup when user logs out
        badgeStore.cleanup();
        achievementStore.cleanup();
      }
      isLoading = false;
      clearTimeout(timeoutId);
    });

    // Subscribe to onboarding status
    const unsubscribeOnboarding = onboardingComplete.subscribe(complete => {
      showOnboarding = !complete;
    });

    return () => {
      unsubscribe();
      unsubscribeOnboarding();
      badgeStore.cleanup();
      achievementStore.cleanup();
      clearTimeout(timeoutId);
    };
  });

  onMount(async () => {
    if (DEBUG_MODE) return;
    
    try {
      await setupNotifications();
    } catch (error) {
      console.error('Failed to setup notifications:', error);
    }
  });

  // Handle notification navigation
  navigationStore.subscribe((targetPage) => {
    if (targetPage) {
      activeTab = targetPage;
      navigationStore.set(null); // Reset after handling
    }
  });

  function handleTabChange(event) {
    activeTab = event.detail;
  }

  function navigateTo(page) {
    activeTab = page;
  }

  function handleWelcomeClose() {
    showWelcomePopup = false;
  }

  function handleSubscribe() {
    showWelcomePopup = false;
    navigateTo('subscription');
  }
</script>

{#if isLoading}
  <div class="loading-container">
    <img src="/Logo.png" alt="Deen Reflections Logo" class="loading-logo" />
    {#if initializationError}
      <p class="error-message">Error: {initializationError}</p>
    {/if}
  </div>
{:else if showOnboarding}
  <Onboarding />
{:else if user || DEBUG_MODE}
  <div class="app-container">
    {#if showWelcomePopup}
      <WelcomePopup 
        userId={user?.uid}
        showPopup={showWelcomePopup}
        on:close={handleWelcomeClose}
        on:subscribe={handleSubscribe}
      />
    {/if}
    
    <Notification />
    
    {#if activeTab !== 'notifications' && (!hasTrialEnded || isSubscribed)}
      <NotificationIcon on:click={() => navigateTo('notifications')} />
    {/if}
    
    <main>
      {#if hasTrialEnded && !isSubscribed}
        <Subscription />
      {:else if activeTab === 'home'}
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
      {:else if activeTab === 'quran'}
        <QuranReading />
      {:else if activeTab === 'tasbih'}
        <Tasbih />
      {:else if activeTab === 'progress'}
        <Progress onBack={() => navigateTo('profile')} />
      {:else if activeTab === 'achievements'}
        <Achievements onBack={() => navigateTo('profile')} />
      {:else if activeTab === 'subscription'}
        <Subscription on:back={() => navigateTo('profile')} />
      {:else}
        <Home />
      {/if}
    </main>
    {#if !hasTrialEnded || isSubscribed}
      <BottomNav {activeTab} on:tabChange={handleTabChange} />
    {/if}
  </div>
{:else}
  <main>
    <SignIn />
  </main>
{/if}

<style>
  .loading-container {
    width: 100vw;
    height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    background: #fff;
    overflow: hidden;
    box-sizing: border-box;
    flex-direction: column;
  }

  .loading-logo {
    width: auto;
    height: 120px;
    animation: pulse 2s infinite;
    margin-bottom: 20px;
  }
  
  .error-message {
    color: #e53935;
    text-align: center;
    max-width: 80%;
    font-size: 14px;
  }

  @keyframes pulse {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.03); opacity: 0.95; }
    100% { transform: scale(1); opacity: 1; }
  }

  .app-container {
    position: relative;
    width: 100%;
    min-height: 100vh;
    padding-bottom: 80px;
    background: #F8FAFC;
    overflow-x: hidden;
    box-sizing: border-box;
  }

  main {
    width: 100%;
    min-height: calc(100vh - 80px);
    box-sizing: border-box;
    overflow-x: hidden;
  }

  :global(body) {
    margin: 0;
    padding: 0;
    overflow-x: hidden;
    width: 100%;
  }

  :global(*) {
    box-sizing: border-box;
  }
</style>
