<script>
  import { House, Mosque, ChartLine, Book, User } from 'phosphor-svelte';
  
  export let activeTab = 'home';
  
  function setActiveTab(tab) {
    activeTab = tab;
    dispatch('tabChange', tab);
  }

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
</script>

<nav class="bottom-nav">
  <div class="nav-container">
    <div class="nav-group">
      <button 
        class="nav-item {activeTab === 'prayer' ? 'active' : ''}" 
        on:click={() => setActiveTab('prayer')}
      >
        <Mosque weight={activeTab === 'prayer' ? 'fill' : 'regular'} size={20} />
        <span>Worship</span>
      </button>
      
      <button 
        class="nav-item {activeTab === 'journal' ? 'active' : ''}" 
        on:click={() => setActiveTab('journal')}
      >
        <Book weight={activeTab === 'journal' ? 'fill' : 'regular'} size={20} />
        <span>Journal</span>
      </button>
    </div>

    <button 
      class="nav-item home-button {activeTab === 'home' ? 'active' : ''}" 
      on:click={() => setActiveTab('home')}
    >
      <House weight={activeTab === 'home' ? 'fill' : 'regular'} size={24} />
    </button>

    <div class="nav-group">
      <button 
        class="nav-item {activeTab === 'tracker' ? 'active' : ''}" 
        on:click={() => setActiveTab('tracker')}
      >
        <ChartLine weight={activeTab === 'tracker' ? 'fill' : 'regular'} size={20} />
        <span>Tracker</span>
      </button>
      
      <button 
        class="nav-item {activeTab === 'profile' ? 'active' : ''}" 
        on:click={() => setActiveTab('profile')}
      >
        <User weight={activeTab === 'profile' ? 'fill' : 'regular'} size={20} />
        <span>Profile</span>
      </button>
    </div>
  </div>
</nav>

<style>
  .bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    background: white;
    height: 64px;
    border-top: 1px solid #eee;
  }

  .nav-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 100%;
    position: relative;
    max-width: 420px;
    margin: 0 auto;
    padding: 0 24px;
  }

  .nav-group {
    display: flex;
    gap: 48px;
  }

  .nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 0;
    background: transparent;
    border: none;
    color: #999;
    transition: color 0.2s ease;
    font-size: 12px;
    cursor: pointer;
  }

  .home-button {
    width: 48px;
    height: 48px;
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    background: linear-gradient(135deg, #E09453, #E09453);
    border: none;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    color: white;
  }

  .nav-item.active {
    color: #E09453;
  }

  @media (prefers-color-scheme: dark) {
    .bottom-nav {
      background: #171717;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .nav-item {
      color: #666;
    }
  }
</style> 