<script>
    import { createEventDispatcher } from 'svelte';
    import { trialStore, startTrial, getTrialTimeRemaining, formatTrialTimeRemaining } from '../services/trialService';
    import { subscriptionStore } from '../services/revenuecat';
    import { fade, fly } from 'svelte/transition';
    
    export let userId;
    export let showPopup = true;
    
    const dispatch = createEventDispatcher();
    
    $: isInTrial = $trialStore.isInTrial;
    $: hasTrialEnded = $trialStore.hasTrialEnded;
    $: isSubscribed = $subscriptionStore.isSubscribed;
    $: trialTimeRemaining = getTrialTimeRemaining();
    
    function handleStartTrial() {
        startTrial(userId);
        dispatch('close');
    }
    
    function handleGetAccess() {
        dispatch('subscribe');
    }
    
    function handleClose() {
        dispatch('close');
    }
</script>

{#if showPopup}
<div class="popup-overlay" transition:fade>
    <div class="popup-content" transition:fly="{{ y: 20, duration: 300 }}">
        <div class="welcome-card">
            <h1>Welcome to Deen Reflections</h1>
            <p class="subtitle">Strengthening your connection with Allah (swt)</p>
            <p class="description">
                Transform your daily worship with personalized insights, meaningful reminders,
                and powerful tracking tools.
            </p>
            
            {#if isSubscribed}
                <p class="status-message success">
                    Thank you for your subscription! You have full access to all features.
                </p>
            {:else if isInTrial}
                <p class="status-message trial">
                    Your free trial is active - {formatTrialTimeRemaining(trialTimeRemaining)}
                </p>
                <button class="primary-button" on:click={handleGetAccess}>
                    Get Full Access Now
                </button>
            {:else if hasTrialEnded}
                <p class="status-message ended">
                    Your free trial has ended
                </p>
                <button class="primary-button" on:click={handleGetAccess}>
                    Get Full Access Now
                </button>
                <button class="secondary-button" disabled>
                    Free Trial Ended
                </button>
            {:else}
                <button class="primary-button" on:click={handleGetAccess}>
                    Get Full Access Now
                </button>
                <button class="secondary-button" on:click={handleStartTrial}>
                    Start Your Free Trial
                </button>
            {/if}
        </div>
        
        <button class="close-button" on:click={handleClose}>×</button>
    </div>
</div>
{/if}

<style>
    .popup-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 1rem;
    }
    
    .popup-content {
        position: relative;
        width: 100%;
        max-width: 480px;
        background: white;
        border-radius: 16px;
        padding: 2rem;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    
    .welcome-card {
        text-align: center;
    }
    
    h1 {
        font-size: 2rem;
        font-weight: bold;
        margin-bottom: 0.5rem;
        color: #1a237e;
    }
    
    .subtitle {
        font-size: 1.2rem;
        color: #666;
        margin-bottom: 1rem;
    }
    
    .description {
        color: #444;
        margin-bottom: 2rem;
        line-height: 1.5;
    }
    
    .status-message {
        margin-bottom: 1.5rem;
        padding: 0.75rem;
        border-radius: 8px;
        font-weight: 500;
    }
    
    .status-message.success {
        background: #E8F5E9;
        color: #2E7D32;
    }
    
    .status-message.trial {
        background: #E3F2FD;
        color: #1565C0;
    }
    
    .status-message.ended {
        background: #FFEBEE;
        color: #C62828;
    }
    
    .primary-button {
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
        margin-bottom: 1rem;
    }
    
    .primary-button:hover {
        background: #283593;
    }
    
    .secondary-button {
        width: 100%;
        padding: 1rem;
        background: white;
        color: #1a237e;
        border: 2px solid #1a237e;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s;
    }
    
    .secondary-button:hover:not(:disabled) {
        background: #E8EAF6;
    }
    
    .secondary-button:disabled {
        border-color: #ccc;
        color: #666;
        cursor: not-allowed;
    }
    
    .close-button {
        position: absolute;
        top: 1rem;
        right: 1rem;
        background: none;
        border: none;
        font-size: 1.5rem;
        color: #666;
        cursor: pointer;
        padding: 0.5rem;
        line-height: 1;
        border-radius: 50%;
        transition: background 0.2s;
    }
    
    .close-button:hover {
        background: rgba(0, 0, 0, 0.05);
    }
</style> 