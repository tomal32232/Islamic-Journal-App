<script>
  import { auth } from '../firebase';
  
  const user = auth.currentUser;
  
  async function handleLogout() {
    try {
      await auth.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  }
</script>

<main class="profile-container">
  <div class="profile-content">
    <div class="profile-header">
      <img 
        src={user?.photoURL || 'default-avatar.png'} 
        alt="Profile" 
        class="profile-image"
      />
      <h1>{user?.displayName || 'User'}</h1>
      <p>{user?.email}</p>
    </div>
    
    <button class="logout-button" on:click={handleLogout}>
      Sign Out
    </button>
  </div>
</main>

<style>
  .profile-container {
    padding: 2rem 1rem;
    padding-bottom: 64px;
  }

  .profile-content {
    max-width: 600px;
    margin: 0 auto;
  }

  .profile-header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .profile-image {
    width: 120px;
    height: 120px;
    border-radius: 60px;
    margin-bottom: 1rem;
  }

  .logout-button {
    width: 100%;
    background-color: #dc3545;
    color: white;
    padding: 1rem;
    border: none;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .logout-button:hover {
    background-color: #c82333;
  }
</style> 