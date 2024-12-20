<script>
  import { House, Mosque, Scroll, Book, User } from 'phosphor-svelte';
  
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
        <span>Prayer</span>
      </button>
      
      <button 
        class="nav-item {activeTab === 'tasbih' ? 'active' : ''}" 
        on:click={() => setActiveTab('tasbih')}
      >
        <Scroll weight={activeTab === 'tasbih' ? 'fill' : 'regular'} size={20} />
        <span>Tasbih</span>
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
        class="nav-item {activeTab === 'journal' ? 'active' : ''}" 
        on:click={() => setActiveTab('journal')}
      >
        <Book weight={activeTab === 'journal' ? 'fill' : 'regular'} size={20} />
        <span>Journal</span>
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
    bottom: 16px;
    left: 16px;
    right: 16px;
    z-index: 1000;
    padding: 0 16px;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-radius: 32px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
    border: 1px solid rgba(33, 105, 116, 0.1);
    height: 64px;
    max-width: 400px;
    margin: 0 auto;
  }

  .nav-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 100%;
    position: relative;
  }

  .nav-group {
    display: flex;
    gap: 32px;
  }

  .nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px 0;
    background: transparent;
    border: none;
    color: #666;
    transition: all 0.3s ease;
    font-size: 11px;
  }

  .home-button {
    width: 50px;
    height: 50px;
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -60%);
    background: transparent;
    border: 2px solid #E09453;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    color: #666;
    transition: all 0.3s ease;
  }

  .nav-item.active {
    color: #E09453;
  }

  .home-button.active {
    background: #216974;
    color: white;
    border: none;
  }

  @media (prefers-color-scheme: dark) {
    .bottom-nav {
      background: rgba(23, 23, 23, 0.95);
      border-color: rgba(255, 255, 255, 0.1);
    }
  }
</style> 