<script>
  import { auth } from '../firebase';
  import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

  async function handleGoogleSignIn() {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      console.log("Signed in user:", result.user);
    } catch (error) {
      console.error("Error signing in:", error);
    }
  }
</script>

<main class="signin-container">
  <div class="content">
    <h1>Welcome to Islamic Journal</h1>
    <p>Please sign in to continue</p>
    <button on:click={handleGoogleSignIn} class="google-button">
      Sign in with Google
    </button>
  </div>
</main>

<style>
  .signin-container {
    width: 100%;
    height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: var(--background-color, #f5f5f5);
  }

  .content {
    text-align: center;
    padding: 2rem;
    border-radius: 8px;
    background-color: white;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  h1 {
    font-size: 1.5rem;
    margin-bottom: 1rem;
    color: #333;
  }

  p {
    margin-bottom: 2rem;
    color: #666;
  }

  .google-button {
    background-color: #4285f4;
    color: white;
    padding: 0.8em 1.5em;
    border: none;
    border-radius: 4px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .google-button:hover {
    background-color: #357ae8;
  }
</style>
