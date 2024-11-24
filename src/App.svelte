<script>
  import { onMount } from 'svelte';
  import { auth } from './lib/firebase';
  import SignIn from './lib/pages/SignIn.svelte';
  import Home from './lib/pages/Home.svelte';
  import Notifications from './lib/pages/Notifications.svelte';
  import NotificationIcon from './lib/components/NotificationIcon.svelte';

  let user = null;
  let currentPage = 'home';

  onMount(() => {
    auth.onAuthStateChanged((authUser) => {
      user = authUser;
    });
  });

  function navigateTo(page) {
    currentPage = page;
  }
</script>

{#if user}
  <div class="app-container">
    {#if currentPage !== 'notifications'}
      <NotificationIcon on:click={() => navigateTo('notifications')} />
    {/if}
    
    <main>
      {#if currentPage === 'home'}
        <Home />
      {:else if currentPage === 'notifications'}
        <Notifications onBack={() => navigateTo('home')} />
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
  }

  main {
    width: 100%;
    min-height: 100vh;
  }
</style>
