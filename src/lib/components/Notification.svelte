<!-- Notification.svelte -->
<script>
    import { notificationStore } from '../stores/notificationStore';
    import { fly, fade } from 'svelte/transition';
    import { Trophy } from 'phosphor-svelte';

    // Create confetti effect
    function createConfetti() {
        const confetti = [];
        const colors = ['#FFD700', '#216974', '#E09453', '#4CAF50', '#9C27B0'];
        
        for (let i = 0; i < 50; i++) {
            confetti.push({
                color: colors[Math.floor(Math.random() * colors.length)],
                x: Math.random() * 100,
                y: Math.random() * 100,
                r: Math.random() * 4 + 1
            });
        }
        
        return confetti;
    }

    // Debug logging
    $: if ($notificationStore.length > 0) {
        console.log('Active notifications:', $notificationStore);
    }
</script>

<div class="notifications-container">
    {#each $notificationStore as notification (notification.id)}
        {@const confetti = createConfetti()}
        <div class="notification-overlay" transition:fade>
            <div
                class="notification"
                transition:fly={{ y: 50, duration: 300 }}
            >
                <div class="notification-content">
                    <div class="icon">
                        <Trophy weight="fill" size={24} />
                    </div>
                    <p>{notification.message}</p>
                </div>
                
                <!-- Confetti effect -->
                <div class="confetti-container">
                    {#each confetti as particle}
                        <div
                            class="confetti"
                            style="
                                left: {particle.x}%;
                                top: {particle.y}%;
                                background-color: {particle.color};
                                width: {particle.r}px;
                                height: {particle.r}px;
                            "
                        />
                    {/each}
                </div>

                <!-- Close button -->
                <button 
                    class="close-button"
                    on:click={() => notificationStore.removeNotification(notification.id)}
                >
                    Got it!
                </button>
            </div>
        </div>
    {/each}
</div>

<style>
    .notifications-container {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        pointer-events: none;
    }

    .notification-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
    }

    .notification {
        background: white;
        border-radius: 16px;
        padding: 1.5rem;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        width: 90%;
        max-width: 400px;
        position: relative;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        animation: pop-in 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    }

    .notification-content {
        display: flex;
        align-items: center;
        gap: 1rem;
        position: relative;
        z-index: 2;
    }

    .icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        background: #216974;
        border-radius: 50%;
        color: white;
        flex-shrink: 0;
    }

    p {
        margin: 0;
        color: #333;
        font-size: 1rem;
        line-height: 1.5;
        flex: 1;
        word-break: break-word;
    }

    .close-button {
        background: #216974;
        color: white;
        border: none;
        border-radius: 12px;
        padding: 0.75rem 2rem;
        font-size: 1rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        width: 100%;
    }

    .close-button:hover {
        background: #1a545d;
        transform: translateY(-1px);
    }

    .close-button:active {
        transform: translateY(0);
    }

    .confetti-container {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        overflow: hidden;
    }

    .confetti {
        position: absolute;
        animation: confetti-fall 1.5s ease-out forwards;
    }

    @keyframes pop-in {
        0% {
            transform: scale(0.8);
            opacity: 0;
        }
        100% {
            transform: scale(1);
            opacity: 1;
        }
    }

    @keyframes confetti-fall {
        0% {
            transform: translateY(-10px) rotate(0deg);
            opacity: 1;
        }
        100% {
            transform: translateY(100px) rotate(360deg);
            opacity: 0;
        }
    }
</style> 