<script>
  import BottomNav from '../BottomNav.svelte';
  import Profile from './Profile.svelte';
  
  let currentPage = 'home';

  function handleTabChange(event) {
    currentPage = event.detail;
  }
</script>

<main class="home-container">
  <div class="content">
    {#if currentPage === 'profile'}
      <Profile />
    {:else if currentPage === 'home'}
      <h1>Islamic Journal</h1>
      <!-- Add your home page content here -->
    {/if}
  </div>
  <BottomNav activeTab={currentPage} on:tabChange={handleTabChange} />
</main>

<style>
  .home-container {
    padding: 1rem;
    padding-bottom: 64px; /* Space for bottom nav */
  }

  .content {
    max-width: 800px;
    margin: 0 auto;
  }

  h1 {
    font-size: 1.5rem;
    margin-bottom: 1rem;
  }
</style>
