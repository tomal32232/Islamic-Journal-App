<script>
  import { onMount } from 'svelte';
  import { auth } from '$lib/firebase';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import Logo from '$lib/components/Logo.svelte';
  import NotificationIcon from '$lib/components/NotificationIcon.svelte';
  import { userStore } from '$lib/stores/userStore';

  let menuOpen = false;

  function toggleMenu() {
    menuOpen = !menuOpen;
  }

  function closeMenu() {
    menuOpen = false;
  }
</script>

<div class="app">
  <header>
    <nav>
      <div class="nav-start">
        <a href="/" class="logo">
          <Logo />
        </a>
      </div>

      <button class="menu-button" on:click={toggleMenu}>
        <i class="fas fa-bars"></i>
      </button>

      <div class="nav-middle" class:open={menuOpen}>
        <a 
          href="/" 
          class="nav-link" 
          class:active={$page.url.pathname === '/'} 
          on:click={closeMenu}
        >
          Home
        </a>
        <a 
          href="/journal" 
          class="nav-link" 
          class:active={$page.url.pathname === '/journal'} 
          on:click={closeMenu}
        >
          Journal
        </a>
        <a 
          href="/prayer" 
          class="nav-link" 
          class:active={$page.url.pathname === '/prayer'} 
          on:click={closeMenu}
        >
          Prayer
        </a>
        <a 
          href="/quran" 
          class="nav-link" 
          class:active={$page.url.pathname === '/quran'} 
          on:click={closeMenu}
        >
          Quran
        </a>
        <a 
          href="/tasbih" 
          class="nav-link" 
          class:active={$page.url.pathname === '/tasbih'} 
          on:click={closeMenu}
        >
          Tasbih
        </a>
      </div>

      <div class="nav-end">
        <NotificationIcon />
        <a 
          href="/profile" 
          class="nav-link profile-link" 
          class:active={$page.url.pathname === '/profile'}
        >
          <i class="fas fa-user"></i>
        </a>
      </div>
    </nav>
  </header>

  <main>
    <slot />
  </main>
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  header {
    background: white;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    position: sticky;
    top: 0;
    z-index: 100;
  }

  nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 1rem;
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
  }

  .nav-start, .nav-end {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .nav-middle {
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  .nav-link {
    color: #216974;
    text-decoration: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    transition: background-color 0.2s;
  }

  .nav-link:hover {
    background-color: rgba(33, 105, 116, 0.1);
  }

  .nav-link.active {
    background-color: rgba(33, 105, 116, 0.1);
    font-weight: 500;
  }

  .menu-button {
    display: none;
    background: none;
    border: none;
    font-size: 1.5rem;
    color: #216974;
    cursor: pointer;
    padding: 0.5rem;
  }

  main {
    flex: 1;
    padding: 1rem;
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
  }

  @media (max-width: 768px) {
    .menu-button {
      display: block;
    }

    .nav-middle {
      display: none;
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      flex-direction: column;
      padding: 1rem;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .nav-middle.open {
      display: flex;
    }

    .nav-link {
      width: 100%;
      text-align: center;
    }
  }
</style> 