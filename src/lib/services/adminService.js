import { getAuth } from 'firebase/auth';

export async function checkAdminStatus() {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      console.log('No user is currently logged in');
      return false;
    }

    const idTokenResult = await user.getIdTokenResult();
    const isAdmin = idTokenResult.claims.admin === true;
    
    console.log('Admin status:', isAdmin);
    console.log('All claims:', idTokenResult.claims);
    
    return isAdmin;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
} 