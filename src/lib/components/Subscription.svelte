<!-- Subscription.svelte -->
<script>
    import { onMount } from 'svelte';
    import { subscriptionStore, getCurrentOffering, purchasePackage, restorePurchases, initializeRevenueCat } from '../services/revenuecat';
    import { trialStore, getTrialTimeRemaining, formatTrialTimeRemaining } from '../services/trialService';
    import { Purchases } from '@revenuecat/purchases-capacitor';
    import { Capacitor } from '@capacitor/core';
    
    let isLoading = true;
    let error = null;
    let offerings = null;
    let selectedPlan = 'annual'; // Default to annual plan
    let initializationAttempts = 0;
    const MAX_RETRIES = 3;
    
    // Subscribe to subscription status
    $: isSubscribed = $subscriptionStore.isSubscribed;
    $: isInTrial = $trialStore.isInTrial;
    $: hasTrialEnded = $trialStore.hasTrialEnded;
    $: trialTimeRemaining = getTrialTimeRemaining();
    
    $: monthlyPrice = offerings?.monthly?.product?.priceString || 'BDT 420';
    $: annualPrice = offerings?.annual?.product?.priceString || 'BDT 2,800';
    $: monthlyTitle = 'Monthly Journey';
    $: annualTitle = 'Annual Journey';
    $: monthlyDescription = offerings?.monthly?.product?.description;
    $: annualDescription = offerings?.annual?.product?.description;
    
    async function loadOfferings() {
        console.log('Starting to load offerings...');
        try {
            // Ensure RevenueCat is initialized first
            if (initializationAttempts < MAX_RETRIES) {
                console.log(`Initialization attempt ${initializationAttempts + 1} of ${MAX_RETRIES}`);
                try {
                    await Promise.race([
                        initializeRevenueCat(),
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Initialization timeout')), 15000)
                        )
                    ]);
                    initializationAttempts++;
                } catch (initError) {
                    console.error('Initialization failed:', initError);
                    if (initError.message === 'Initialization timeout') {
                        // Reset initialization state and retry
                        console.log('Initialization timed out, retrying...');
                        error = 'Initializing payment system...';
                        setTimeout(() => {
                            console.log('Retrying after timeout...');
                            error = null;
                            isLoading = true;
                            loadOfferings();
                        }, 2000);
                        return;
                    }
                    throw initError;
                }
            }
            
            console.log('Getting offerings from RevenueCat...');
            try {
                offerings = await getCurrentOffering();
                console.log('Successfully loaded offerings');
                isLoading = false;
                error = null;
            } catch (offeringsError) {
                console.error('Failed to load offerings:', offeringsError);
                
                // Display a user-friendly error message
                if (offeringsError.message?.includes('RevenueCat configuration error')) {
                    error = offeringsError.message;
                } else if (offeringsError.message?.includes('must be configured')) {
                    error = 'Initializing payment system...';
                    // Retry after a short delay
                    setTimeout(() => {
                        console.log('Retrying subscription load...');
                        error = null;
                        isLoading = true;
                        loadOfferings();
                    }, 2000);
                } else {
                    error = 'Unable to load subscription options. Please try again later.';
                }
                isLoading = false;
            }
        } catch (err) {
            console.error('Subscription loading error:', err);
            console.error('Error details:', {
                message: err.message,
                code: err.code,
                stack: err.stack
            });
            
            error = err.message || 'Failed to load subscription options';
            isLoading = false;
        }
    }
    
    onMount(() => {
        console.log('Subscription component mounted, loading offerings...');
        loadOfferings();
    });
    
    async function handlePurchase(plan) {
        console.log(`Attempting to purchase ${plan} plan...`);
        try {
            if (!offerings?.[plan]) {
                console.error(`Selected plan ${plan} not available`);
                throw new Error('Selected plan is not available');
            }
            
            isLoading = true;
            error = null;
            
            console.log('Ensuring RevenueCat is initialized...');
            await initializeRevenueCat();
            console.log(`Processing purchase for ${plan} plan...`);
            await purchasePackage(offerings[plan]);
            console.log('Purchase successful');
        } catch (err) {
            console.error('Purchase error:', err);
            console.error('Error details:', {
                message: err.message,
                code: err.code,
                stack: err.stack
            });

            if (err.code === 'PURCHASE_CANCELLED') {
                console.log('Purchase cancelled by user');
                return;
            }
            error = err.message || 'Failed to process purchase';
        } finally {
            isLoading = false;
        }
    }
    
    async function handleRestore() {
        try {
            isLoading = true;
            error = null;
            
            // Ensure RevenueCat is initialized before restore
            await initializeRevenueCat();
            await restorePurchases();
        } catch (err) {
            error = err.message || 'Failed to restore purchases';
        } finally {
            isLoading = false;
        }
    }

    async function handleManageSubscription() {
        try {
            if (Capacitor.getPlatform() === 'android') {
                window.open('market://account/subscriptions', '_blank');
            } else if (Capacitor.getPlatform() === 'ios') {
                window.open('itms-apps://apps.apple.com/account/subscriptions', '_blank');
            } else {
                // Fallback for web
                console.log('Subscription management not available on web');
            }
        } catch (error) {
            console.error('Error opening subscription management:', error);
        }
    }
</script>

<div class="subscription-container">
    <div class="header">
        <h1 class="title">Begin Your Spiritual Journey</h1>
        <p class="subtitle">Choose your path to enhance your daily worship and strengthen your connection with Allah (swt)</p>
    </div>

    {#if isLoading}
        <div class="loading">Loading subscription options...</div>
    {:else if error}
        <div class="error">
            {error}
            <button class="retry-button" on:click={() => {
                error = null;
                isLoading = true;
                loadOfferings();
            }}>
                Try Again
            </button>
        </div>
    {:else if isSubscribed}
        <div class="success">
            <h2>Thank you for your subscription!</h2>
            <p>You have full access to all premium features.</p>
            <button class="manage-button" on:click={handleManageSubscription}>
                Manage Subscription
            </button>
        </div>
    {:else if offerings?.monthly || offerings?.annual}
        <div class="plans">
            <!-- Monthly Plan -->
            <div class="plan-card {selectedPlan === 'monthly' ? 'selected' : ''}"
                 on:click={() => selectedPlan = 'monthly'}>
                <h3>{monthlyTitle}</h3>
                <div class="price">{monthlyPrice}<span>/month</span></div>
                <ul>
                    {#if monthlyDescription}
                        <li>{monthlyDescription}</li>
                    {:else}
                        <li>Worship tracking</li>
                        <li>Prayer reminders</li>
                        <li>Progress analytics</li>
                    {/if}
                </ul>
                <button 
                    class="plan-button"
                    disabled={isLoading}
                    on:click={() => handlePurchase('monthly')}>
                    Start Monthly Journey
                </button>
            </div>
            
            <!-- Annual Plan -->
            <div class="plan-card {selectedPlan === 'annual' ? 'selected' : ''}"
                 on:click={() => selectedPlan = 'annual'}>
                <div class="save-badge">Save 44%</div>
                <h3>{annualTitle}</h3>
                <div class="price">{annualPrice}<span>/year</span></div>
                <ul>
                    {#if annualDescription}
                        <li>{annualDescription}</li>
                    {:else}
                        <li>All monthly features</li>
                        <li>Priority support</li>
                        <li>Advanced analytics</li>
                    {/if}
                </ul>
                <button 
                    class="plan-button"
                    disabled={isLoading}
                    on:click={() => handlePurchase('annual')}>
                    Start Annual Journey
                </button>
            </div>
        </div>
        
        <button class="restore-button" on:click={handleRestore}>
            Restore Purchase
        </button>
        
        {#if isInTrial}
            <p class="trial-note">
                Free trial - {formatTrialTimeRemaining(trialTimeRemaining)} remaining
            </p>
        {:else if hasTrialEnded}
            <p class="trial-note trial-ended">
                Your free trial has ended. Subscribe to continue using premium features.
            </p>
        {/if}
    {:else}
        <div class="error">
            Unable to load subscription options.
            <button class="retry-button" on:click={() => {
                error = null;
                isLoading = true;
                loadOfferings();
            }}>
                Try Again
            </button>
        </div>
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
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        align-items: center;
    }
    
    .header {
        margin-bottom: 2.5rem;
        width: 100%;
        max-width: 600px;
    }
    
    .title {
        font-size: 2rem;
        font-weight: bold;
        margin-bottom: 0.75rem;
        color: #216974;
        letter-spacing: -0.5px;
    }
    
    .subtitle {
        font-size: 1.1rem;
        color: #666;
        margin: 0;
        line-height: 1.5;
        max-width: 600px;
        margin: 0 auto;
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
        max-width: 800px;
        padding: 0;
        box-sizing: border-box;
    }

    @media (min-width: 768px) {
        .subscription-container {
            padding: 2rem 1rem;
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
    
    .trial-note.trial-ended {
        background: rgba(239, 68, 68, 0.05);
        color: #ef4444;
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
    
    .retry-button {
        background: transparent;
        border: none;
        color: #216974;
        text-decoration: underline;
        cursor: pointer;
        margin-top: 1rem;
        padding: 0.5rem;
        font-size: 0.9rem;
        display: block;
        width: fit-content;
        margin: 1rem auto 0;
    }
    
    .retry-button:hover {
        color: #184f57;
    }

    .manage-button {
        background: transparent;
        border: 2px solid #216974;
        color: #216974;
        padding: 0.75rem 1.5rem;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        margin-top: 1rem;
    }
    
    .manage-button:hover {
        background: rgba(33, 105, 116, 0.05);
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(33, 105, 116, 0.1);
    }
</style> 