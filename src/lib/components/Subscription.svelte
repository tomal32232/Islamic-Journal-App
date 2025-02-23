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
        padding: 1rem;
        width: 100%;
        max-width: 800px;
        margin: 0 auto;
        text-align: center;
        box-sizing: border-box;
        min-height: calc(100vh - 140px);
    }
    
    .title {
        font-size: 2rem;
        font-weight: bold;
        margin-bottom: 0.5rem;
        color: #216974;
    }
    
    .subtitle {
        font-size: 1.2rem;
        color: #666;
        margin-bottom: 1rem;
    }
    
    .description {
        margin-bottom: 2rem;
        color: #444;
        line-height: 1.6;
    }
    
    .plans {
        display: grid;
        grid-template-columns: 1fr;
        gap: 1rem;
        margin: 0 auto 2rem;
        width: 100%;
        padding: 0 1rem;
        box-sizing: border-box;
    }

    @media (min-width: 768px) {
        .subscription-container {
            padding: 2rem;
        }
        
        .plans {
            grid-template-columns: repeat(2, 1fr);
            gap: 2rem;
            padding: 0;
        }
    }
    
    .plan-card {
        width: 100%;
        box-sizing: border-box;
        padding: 1.5rem;
        background: white;
        border-radius: 16px;
        box-shadow: 0 4px 6px rgba(33, 105, 116, 0.1);
        position: relative;
        cursor: pointer;
        transition: all 0.3s ease;
        border: 2px solid transparent;
        margin: 0 auto;
        max-width: 400px;
    }

    @media (min-width: 768px) {
        .plan-card {
            padding: 2rem;
            max-width: none;
        }
    }
    
    .plan-card.selected {
        transform: translateY(-4px);
        box-shadow: 0 8px 16px rgba(33, 105, 116, 0.15);
        border-color: #216974;
    }
    
    .save-badge {
        position: absolute;
        top: -12px;
        right: -12px;
        background: #216974;
        color: white;
        padding: 0.5rem 1rem;
        border-radius: 20px;
        font-size: 0.9rem;
        font-weight: bold;
        box-shadow: 0 2px 4px rgba(33, 105, 116, 0.2);
    }
    
    .price {
        font-size: 2.5rem;
        font-weight: bold;
        margin: 1rem 0;
        color: #216974;
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
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    
    li::before {
        content: "✓";
        color: #216974;
        font-weight: bold;
    }
    
    .plan-button {
        width: 100%;
        padding: 1rem;
        background: #216974;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s;
    }
    
    .plan-button:hover {
        background: #184f57;
        transform: translateY(-1px);
        box-shadow: 0 4px 6px rgba(33, 105, 116, 0.15);
    }
    
    .plan-button:disabled {
        background: #ccc;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
    }
    
    .restore-button {
        background: transparent;
        border: none;
        color: #216974;
        text-decoration: underline;
        cursor: pointer;
        margin: 1rem auto;
        padding: 0.5rem;
        font-size: 0.9rem;
        transition: all 0.2s;
        display: block;
        width: fit-content;
    }
    
    .restore-button:hover {
        color: #184f57;
        transform: translateY(-1px);
    }
    
    .trial-note {
        color: #666;
        font-size: 0.9rem;
        margin: 1rem auto 0;
        padding: 1rem;
        background: rgba(33, 105, 116, 0.05);
        border-radius: 8px;
        width: auto;
        max-width: 400px;
        display: block;
    }
    
    .loading {
        padding: 2rem;
        color: #216974;
        font-size: 1.1rem;
    }
    
    .error {
        color: #ef4444;
        padding: 1rem;
        margin: 1rem 0;
        background: rgba(239, 68, 68, 0.1);
        border-radius: 8px;
    }
    
    .success {
        color: #216974;
        padding: 2rem;
        margin: 1rem 0;
        background: rgba(33, 105, 116, 0.1);
        border-radius: 8px;
    }

    .success h2 {
        color: #216974;
        margin-bottom: 1rem;
    }
</style> 