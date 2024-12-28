<script>
  import { auth } from '../firebase';
  import { GoogleAuthProvider, signInWithPopup, signInWithCredential } from 'firebase/auth';
  import { Capacitor } from '@capacitor/core';
  import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';

  let errorMessage = '';
  let isLoading = false;

  async function handleGoogleSignIn() {
    try {
      isLoading = true;
      errorMessage = '';
      
      if (Capacitor.isNativePlatform()) {
        console.log('Attempting native sign-in...');
        // Native platform (Android/iOS)
        try {
          const user = await GoogleAuth.signIn();
          console.log('Google Auth response:', JSON.stringify(user, null, 2));
          
          if (!user.authentication?.idToken) {
            throw new Error('No ID token received from Google Sign-In');
          }
          
          const credential = GoogleAuthProvider.credential(
            user.authentication.idToken,
            user.authentication.accessToken
          );
          console.log('Created Firebase credential');
          
          const result = await signInWithCredential(auth, credential);
          console.log("Successfully signed in user:", result.user.email);
        } catch (nativeError) {
          console.error('Native sign-in error:', nativeError);
          throw new Error(`Native sign-in failed: ${nativeError.message || 'Unknown error'}`);
        }
      } else {
        // Web platform
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        console.log("Successfully signed in user:", result.user.email);
      }
    } catch (error) {
      console.error("Detailed error:", error);
      errorMessage = error.message || 'An error occurred during sign in';
    } finally {
      isLoading = false;
    }
  }

  // Initialize Google Auth when the component mounts
  if (Capacitor.isNativePlatform()) {
    const platform = Capacitor.getPlatform();
    const initOptions = platform === 'ios' 
      ? {
          clientId: '398086636891-f4e9nj7i8v5q4mep1thflr426obr8dd2.apps.googleusercontent.com',
          scopes: ['profile', 'email'],
          grantOfflineAccess: true,
        }
      : {
          // Android will use the configuration from capacitor.config.json
          scopes: ['profile', 'email'],
          grantOfflineAccess: true,
        };

    GoogleAuth.initialize(initOptions)
      .then(() => console.log('Google Auth initialized successfully'))
      .catch(error => {
        console.error('Failed to initialize Google Auth:', error);
        errorMessage = 'Failed to initialize Google Sign-In';
      });
  }
</script>

<main class="signin-container">
  <div class="content">
    <h1>Welcome to Islamic Journal</h1>
    <p>Please sign in to continue</p>
    <button 
      on:click={handleGoogleSignIn} 
      class="google-button"
      disabled={isLoading}
    >
      {#if isLoading}
        Signing in...
      {:else}
        Sign in with Google
      {/if}
    </button>
    {#if errorMessage}
      <p class="error-message">{errorMessage}</p>
    {/if}
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

  .google-button:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }

  .google-button:not(:disabled):hover {
    background-color: #357ae8;
  }

  .error-message {
    color: #dc3545;
    margin-top: 1rem;
    font-size: 0.875rem;
  }
</style>
