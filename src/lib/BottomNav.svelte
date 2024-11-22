<script>
  import { House, Mosque, Scroll, Book, User } from 'phosphor-svelte';
  
  export let activeTab = 'home';
  
  function setActiveTab(tab) {
    activeTab = tab;
    // Dispatch event for parent components
    dispatch('tabChange', tab);
  }

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
</script>

<nav class="bottom-nav">
  <button 
    class="nav-item {activeTab === 'home' ? 'active' : ''}" 
    on:click={() => setActiveTab('home')}
  >
    <House weight={activeTab === 'home' ? 'fill' : 'regular'} size={24} />
    <span>Home</span>
  </button>
  
  <button 
    class="nav-item {activeTab === 'prayer' ? 'active' : ''}" 
    on:click={() => setActiveTab('prayer')}
  >
    <Mosque weight={activeTab === 'prayer' ? 'fill' : 'regular'} size={24} />
    <span>Prayer</span>
  </button>
  
  <button 
    class="nav-item {activeTab === 'tasbih' ? 'active' : ''}" 
    on:click={() => setActiveTab('tasbih')}
  >
    <Scroll weight={activeTab === 'tasbih' ? 'fill' : 'regular'} size={24} />
    <span>Tasbih</span>
  </button>
  
  <button 
    class="nav-item {activeTab === 'journal' ? 'active' : ''}" 
    on:click={() => setActiveTab('journal')}
  >
    <Book weight={activeTab === 'journal' ? 'fill' : 'regular'} size={24} />
    <span>Journal</span>
  </button>
  
  <button 
    class="nav-item {activeTab === 'profile' ? 'active' : ''}" 
    on:click={() => setActiveTab('profile')}
  >
    <User weight={activeTab === 'profile' ? 'fill' : 'regular'} size={24} />
    <span>Profile</span>
  </button>
</nav>

<style>
  .bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 64px;
    background: #fff;
    box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
    display: flex;
    justify-content: space-around;
    align-items: center;
    padding: 0 8px;
    z-index: 1000;
  }

  .nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    background: none;
    border: none;
    color: #666;
    padding: 8px 4px;
    border-radius: 8px;
    transition: all 0.2s;
    width: 20%;
  }

  .nav-item span {
    font-size: 11px;
    font-weight: 500;
  }

  .nav-item.active {
    color: #E09453;
  }

  @media (prefers-color-scheme: dark) {
    .bottom-nav {
      background: #1a1a1a;
      box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.2);
    }

    .nav-item {
      color: #999;
    }

    .nav-item.active {
      color: #E09453;
    }
  }
</style> 