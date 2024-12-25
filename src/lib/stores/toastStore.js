import { writable } from 'svelte/store';

function createToastStore() {
  const { subscribe, set } = writable({
    message: '',
    type: '',
    visible: false
  });

  let timeoutId;

  return {
    subscribe,
    show: (message, type = 'info', duration = 3000) => {
      if (timeoutId) clearTimeout(timeoutId);
      
      set({
        message,
        type,
        visible: true
      });

      timeoutId = setTimeout(() => {
        set({
          message: '',
          type: '',
          visible: false
        });
      }, duration);
    },
    hide: () => {
      if (timeoutId) clearTimeout(timeoutId);
      set({
        message: '',
        type: '',
        visible: false
      });
    }
  };
}

export const toast = createToastStore(); 