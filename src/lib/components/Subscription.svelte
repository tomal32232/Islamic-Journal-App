<!-- Subscription.svelte -->
<script>
    import { onMount } from 'svelte';
    import { subscriptionStore, getCurrentOffering, purchasePackage, restorePurchases } from '../services/revenuecat';
    
    let isLoading = true;
    let error = null;
    let offerings = null;
    let selectedPlan = 'annual'; // Default to annual plan
    
    // Subscribe to subscription status
    $: isSubscribed = $subscriptionStore.isSubscribed;
    
    onMount(async () => {
        try {
            offerings = await getCurrentOffering();
            isLoading = false;
        } catch (err) {
            error = err.message;
            isLoading = false;
        }
    });
    
    async function handlePurchase(plan) {
        try {
            isLoading = true;
            error = null;
            
            const packageToPurchase = plan === 'annual' ? offerings.annual : offerings.monthly;
            if (!packageToPurchase) {
                throw new Error('Selected package not available');
            }
            
            await purchasePackage(packageToPurchase);
        } catch (err) {
            error = err.message;
        } finally {
            isLoading = false;
        }
    }
    
    async function handleRestore() {
        try {
            isLoading = true;
            error = null;
            await restorePurchases();
        } catch (err) {
            error = err.message;
        } finally {
            isLoading = false;
        }
    }
</script>

<div class="subscription-container">
    <h1 class="title">Welcome to Deen Reflections</h1>
    <p class="subtitle">Strengthening your connection with Allah (swt)</p>
    <p class="description">
        Transform your daily worship with personalized insights, meaningful reminders, and powerful tracking tools.
    </p>
    
    {#if isLoading}
        <div class="loading">Loading...</div>
    {:else if error}
        <div class="error">{error}</div>
    {:else if isSubscribed}
        <div class="success">
            <h2>Thank you for your subscription!</h2>
            <p>You have full access to all premium features.</p>
        </div>
    {:else}
        <div class="plans">
            <!-- Monthly Plan -->
            <div class="plan-card {selectedPlan === 'monthly' ? 'selected' : ''}" 
                 on:click={() => selectedPlan = 'monthly'}>
                <h3>Monthly Journey</h3>
                <div class="price">$2.99<span>/month</span></div>
                <ul>
                    <li>✓ Worship tracking</li>
                    <li>✓ Prayer reminders</li>
                    <li>✓ Progress analytics</li>
                </ul>
                <button 
                    class="plan-button"
                    disabled={isLoading}
                    on:click={() => handlePurchase('monthly')}>
                    Start Monthly Plan
                </button>
            </div>
            
            <!-- Annual Plan -->
            <div class="plan-card {selectedPlan === 'annual' ? 'selected' : ''}"
                 on:click={() => selectedPlan = 'annual'}>
                <div class="save-badge">Save 44%</div>
                <h3>Annual Journey</h3>
                <div class="price">$19.99<span>/year</span></div>
                <ul>
                    <li>✓ All monthly features</li>
                    <li>✓ Priority support</li>
                    <li>✓ Advanced analytics</li>
                </ul>
                <button 
                    class="plan-button"
                    disabled={isLoading}
                    on:click={() => handlePurchase('annual')}>
                    Start Annual Plan
                </button>
            </div>
        </div>
        
        <button class="restore-button" on:click={handleRestore}>
            Restore Purchase
        </button>
        
        <p class="trial-note">
            Start with a 3-day free trial. Cancel anytime.
        </p>
    {/if}
</div>

<style>
    .subscription-container {
        padding: 2rem;
        max-width: 800px;
        margin: 0 auto;
        text-align: center;
    }
    
    .title {
        font-size: 2rem;
        font-weight: bold;
        margin-bottom: 0.5rem;
    }
    
    .subtitle {
        font-size: 1.2rem;
        color: #666;
        margin-bottom: 1rem;
    }
    
    .description {
        margin-bottom: 2rem;
        color: #444;
    }
    
    .plans {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 2rem;
        margin-bottom: 2rem;
    }
    
    .plan-card {
        background: white;
        border-radius: 12px;
        padding: 2rem;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        position: relative;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .plan-card.selected {
        transform: scale(1.02);
        box-shadow: 0 8px 12px rgba(0, 0, 0, 0.15);
        border: 2px solid #4CAF50;
    }
    
    .save-badge {
        position: absolute;
        top: -12px;
        right: -12px;
        background: #4CAF50;
        color: white;
        padding: 0.5rem 1rem;
        border-radius: 20px;
        font-size: 0.9rem;
        font-weight: bold;
    }
    
    .price {
        font-size: 2.5rem;
        font-weight: bold;
        margin: 1rem 0;
    }
    
    .price span {
        font-size: 1rem;
        color: #666;
    }
    
    ul {
        list-style: none;
        padding: 0;
        margin: 1.5rem 0;
        text-align: left;
    }
    
    li {
        margin: 0.8rem 0;
        color: #444;
    }
    
    .plan-button {
        width: 100%;
        padding: 1rem;
        background: #1a237e;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: bold;
        cursor: pointer;
        transition: background 0.2s;
    }
    
    .plan-button:hover {
        background: #283593;
    }
    
    .plan-button:disabled {
        background: #ccc;
        cursor: not-allowed;
    }
    
    .restore-button {
        background: transparent;
        border: none;
        color: #666;
        text-decoration: underline;
        cursor: pointer;
        margin: 1rem 0;
    }
    
    .trial-note {
        color: #666;
        font-size: 0.9rem;
        margin-top: 1rem;
    }
    
    .loading {
        padding: 2rem;
        color: #666;
    }
    
    .error {
        color: #f44336;
        padding: 1rem;
        margin: 1rem 0;
        background: #ffebee;
        border-radius: 8px;
    }
    
    .success {
        color: #4CAF50;
        padding: 2rem;
        margin: 1rem 0;
        background: #E8F5E9;
        border-radius: 8px;
    }
</style> 