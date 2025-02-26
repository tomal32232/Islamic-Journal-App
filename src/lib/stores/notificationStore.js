import { writable } from 'svelte/store';

function createNotificationStore() {
    const { subscribe, set, update } = writable([]);

    return {
        subscribe,
        showNotification: (message, type = 'achievement') => {
            const id = Math.random().toString(36).substr(2, 9);
            console.log('📢 Creating notification:', { id, message, type });
            
            update(notifications => {
                const newNotifications = [...notifications, { id, message, type, timestamp: Date.now() }];
                console.log('Current notifications:', newNotifications);
                return newNotifications;
            });

            // Auto-remove notification after 5 seconds
            setTimeout(() => {
                console.log('🗑️ Auto-removing notification:', id);
                update(notifications => notifications.filter(n => n.id !== id));
            }, 5000);
        },
        removeNotification: (id) => {
            console.log('❌ Manually removing notification:', id);
            update(notifications => notifications.filter(n => n.id !== id));
        },
        clearAll: () => {
            console.log('🧹 Clearing all notifications');
            set([]);
        }
    };
}

export const notificationStore = createNotificationStore(); 