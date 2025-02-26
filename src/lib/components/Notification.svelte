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
        <div
            class="notification"
            transition:fly={{ y: 50, duration: 300 }}
            on:click={() => notificationStore.removeNotification(notification.id)}
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
        </div>
    {/each}
</div>

<style>
    .notifications-container {
        position: fixed;
        bottom: 80px;  /* Increased to avoid bottom nav */
        right: 20px;
        z-index: 9999;  /* Increased z-index */
        display: flex;
        flex-direction: column-reverse;
        gap: 10px;
        pointer-events: none;
        max-width: 90%;
    }

    .notification {
        background: white;
        border-radius: 12px;
        padding: 1rem;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        width: 300px;
        max-width: 100%;
        position: relative;
        overflow: hidden;
        pointer-events: auto;
        cursor: pointer;
        animation: slide-in 0.3s ease-out;
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
        width: 40px;
        height: 40px;
        background: #216974;
        border-radius: 50%;
        color: white;
        flex-shrink: 0;
    }

    p {
        margin: 0;
        color: #333;
        font-size: 0.9rem;
        line-height: 1.4;
        flex: 1;
        word-break: break-word;
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
        animation: confetti-fall 1s ease-out forwards;
    }

    @keyframes slide-in {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes confetti-fall {
        0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
        }
        100% {
            transform: translateY(100px) rotate(360deg);
            opacity: 0;
        }
    }
</style> 