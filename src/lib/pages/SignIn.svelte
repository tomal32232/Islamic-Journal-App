<script>
  import { auth } from '../firebase';
  import { GoogleAuthProvider, signInWithPopup, signInWithCredential, OAuthProvider } from 'firebase/auth';
  import { Capacitor } from '@capacitor/core';
  import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
  import { SignInWithApple } from '@capacitor-community/apple-sign-in';
  import { fly } from 'svelte/transition';

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

  async function handleAppleSignIn() {
    try {
      isLoading = true;
      errorMessage = '';

      if (Capacitor.isNativePlatform()) {
        // Native platform (iOS)
        const result = await SignInWithApple.authorize({
          clientId: 'your.bundle.id',
          redirectURI: 'your-redirect-uri',
          scopes: ['email', 'name'],
        });

        // Create OAuthCredential for Firebase
        const provider = new OAuthProvider('apple.com');
        const credential = provider.credential({
          idToken: result.response.identityToken,
          rawNonce: result.response.nonce,
        });

        // Sign in with Firebase
        await signInWithCredential(auth, credential);
      } else {
        // Web platform
        const provider = new OAuthProvider('apple.com');
        provider.addScope('email');
        provider.addScope('name');
        
        await signInWithPopup(auth, provider);
      }
    } catch (error) {
      console.error("Apple Sign In error:", error);
      errorMessage = error.message || 'An error occurred during Apple sign in';
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

<div class="login-container">
  <div class="login-content">
    <div class="login-top">
      <img src="/Logo.png" alt="Deen Reflections Logo" class="login-logo" />
      <h1>Deen Reflections</h1>
      <p class="login-description">Sign in to continue your spiritual journey</p>
    </div>
    
    <div class="login-bottom">
      <button 
        class="google-login-button" 
        on:click={handleGoogleSignIn}
        disabled={isLoading}
      >
        <img src="https://www.google.com/favicon.ico" alt="Google" class="google-icon" />
        {isLoading ? 'Signing in...' : 'Continue with Google'}
      </button>

      {#if Capacitor.getPlatform() === 'ios' || !Capacitor.isNativePlatform()}
        <button 
          class="apple-login-button" 
          on:click={handleAppleSignIn}
          disabled={isLoading}
        >
          <svg class="apple-icon" viewBox="0 0 24 24">
            <path fill="currentColor" d="M17.05 20.28c-.98.95-2.05.88-3.08.38-1.08-.52-2.07-.53-3.2 0-1.44.71-2.2.51-3.06-.38C3.7 16.52 3.44 11.23 6.85 9.24c1.21-.71 2.09-.78 2.91-.28 1.02.62 2.04.6 3.12 0 1.21-.69 2.09-.57 2.91.28.65.66 1.13 1.57 1.36 2.7-3.47 1.33-2.98 5.73.95 6.71-.5.77-1.08 1.28-1.05 1.63zm-1.8-15.53c0 1.33-1.18 2.42-2.51 2.42-1.39-.03-2.66-1.23-2.6-2.63 0-1.31 1.2-2.43 2.54-2.42 1.38.01 2.62 1.21 2.57 2.63z"/>
          </svg>
          {isLoading ? 'Signing in...' : 'Continue with Apple'}
        </button>
      {/if}
      
      {#if errorMessage}
        <p class="error-message">{errorMessage}</p>
      {/if}
      
      <p class="privacy-note">
        By continuing, you agree to our Terms of Service and Privacy Policy
      </p>
    </div>
  </div>
</div>

<style>
  .login-container {
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    position: fixed;
    top: 0;
    left: 0;
    overflow: hidden;
    background-color: white;
  }

  .login-content {
    width: 100%;
    height: 100%;
    max-width: 320px;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem 0;
  }

  .login-top {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .login-bottom {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .login-logo {
    width: auto;
    height: 80px;
    margin-bottom: 1rem;
  }

  h1 {
    color: #216974;
    font-size: 1.75rem;
    margin: 0;
    font-weight: 600;
  }

  .login-description {
    color: #666;
    font-size: 1rem;
    margin: 0;
  }

  .google-login-button {
    width: 100%;
    max-width: 280px;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 25px;
    background-color: #216974;
    color: white;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    box-shadow: 0 2px 4px rgba(33, 105, 116, 0.15);
  }

  .google-login-button:hover:not(:disabled) {
    background-color: #1a545d;
    transform: translateY(-1px);
    box-shadow: 0 4px 6px rgba(33, 105, 116, 0.2);
  }

  .google-login-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .google-icon {
    width: 18px;
    height: 18px;
  }

  .apple-login-button {
    width: 100%;
    max-width: 280px;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 25px;
    background-color: #000;
    color: white;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
    margin-top: 0.5rem;
  }

  .apple-login-button:hover:not(:disabled) {
    background-color: #333;
    transform: translateY(-1px);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
  }

  .apple-login-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .apple-icon {
    width: 18px;
    height: 18px;
  }

  .privacy-note {
    color: #666;
    font-size: 0.85rem;
    max-width: 280px;
    line-height: 1.5;
    margin: 0;
    text-align: center;
  }

  .error-message {
    color: #dc3545;
    font-size: 0.875rem;
    text-align: center;
    max-width: 300px;
  }

  @media (min-width: 768px) {
    .login-logo {
      height: 100px;
    }

    h1 {
      font-size: 2rem;
    }

    .login-description {
      font-size: 1.1rem;
    }

    .login-content {
      max-width: 400px;
      padding: 2rem;
    }

    .google-login-button {
      max-width: 300px;
    }

    .apple-login-button {
      max-width: 300px;
      padding: 1rem 2rem;
      font-size: 1.1rem;
    }

    .privacy-note {
      max-width: 300px;
    }
  }
</style>
