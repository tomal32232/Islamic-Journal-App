<script>
  import { onMount } from 'svelte';
  import { auth } from './lib/firebase';
  import SignIn from './lib/pages/SignIn.svelte';
  import Home from './lib/pages/Home.svelte';

  let user = null;

  onMount(() => {
    auth.onAuthStateChanged((authUser) => {
      user = authUser;
    });
  });
</script>

<main>
  {#if user}
    <Home />
  {:else}
    <SignIn />
  {/if}
</main>

<style>
  main {
    width: 100%;
    min-height: 100vh;
  }
</style>
