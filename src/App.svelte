<script>
  import { onMount } from 'svelte';
  import { auth } from './lib/firebase';
  import SignIn from './lib/pages/SignIn.svelte';
  import Home from './lib/pages/Home.svelte';
  import Notifications from './lib/pages/Notifications.svelte';
  import NotificationIcon from './lib/components/NotificationIcon.svelte';
  import Badges from './lib/pages/Badges.svelte';
  import Profile from './lib/pages/Profile.svelte';
  import Tasbih from './lib/pages/Tasbih.svelte';
  import Journal from './lib/pages/Journal.svelte';
  import Prayer from './lib/pages/Prayer.svelte';

  let user = null;
  let activeTab = 'home';

  onMount(() => {
    auth.onAuthStateChanged((authUser) => {
      user = authUser;
    });
  });

  function handleTabChange(event) {
    activeTab = event.detail;
  }

  function navigateTo(page) {
    activeTab = page;
  }
</script>

{#if user}
  <div class="app-container">
    {#if activeTab !== 'notifications'}
      <NotificationIcon on:click={() => navigateTo('notifications')} />
    {/if}
    
    <main>
      {#if activeTab === 'home'}
        <Home />
      {:else if activeTab === 'notifications'}
        <Notifications onBack={() => navigateTo('home')} />
      {:else if activeTab === 'badges'}
        <Badges onBack={() => navigateTo('profile')} />
      {:else if activeTab === 'profile'}
        <Profile {navigateTo} />
      {:else if activeTab === 'tasbih'}
        <Tasbih />
      {:else if activeTab === 'journal'}
        <Journal />
      {:else if activeTab === 'prayer'}
        <Prayer />
      {:else}
        <Home />
      {/if}
    </main>
  </div>
{:else}
  <main>
    <SignIn />
  </main>
{/if}

<style>
  .app-container {
    position: relative;
    width: 100%;
    min-height: 100vh;
    padding-bottom: 80px; /* Increased padding for the bottom nav */
  }

  main {
    width: 100%;
    min-height: 100vh;
  }
</style>
