<script>
  import { onMount } from 'svelte';
  import { Book, BookOpen, Bookmark } from 'phosphor-svelte';

  let selectedCategory = 'all';
  
  const demoEntries = [
    {
      id: 1,
      date: '2024-03-20',
      category: 'reflection',
      title: 'Today\'s Reflection',
      content: 'Alhamdulillah, I felt a deep connection during Fajr prayer today. The silence of the early morning really helped me focus on my duas.',
      tags: ['prayer', 'gratitude']
    },
    {
      id: 2,
      date: '2024-03-19',
      category: 'quran',
      title: 'Surah Al-Mulk Reflection',
      content: 'Read and reflected on Surah Al-Mulk today. The verses about Allah\'s creation really made me contemplate the wonders around us.',
      tags: ['quran', 'reflection']
    },
    {
      id: 3,
      date: '2024-03-18',
      category: 'dua',
      title: 'Morning Adhkar',
      content: 'Started implementing morning adhkar into my routine. The peace it brings to start the day is incredible.',
      tags: ['dhikr', 'morning']
    }
  ];
</script>

<div class="journal-container">
  <div class="journal-header">
    <h2>Islamic Journal</h2>
    <button class="new-entry-btn">
      <Book weight="bold" size={20} />
      New Entry
    </button>
  </div>

  <div class="categories">
    <button 
      class="category-btn {selectedCategory === 'all' ? 'active' : ''}"
      on:click={() => selectedCategory = 'all'}
    >
      All Entries
    </button>
    <button 
      class="category-btn {selectedCategory === 'reflection' ? 'active' : ''}"
      on:click={() => selectedCategory = 'reflection'}
    >
      Reflections
    </button>
    <button 
      class="category-btn {selectedCategory === 'quran' ? 'active' : ''}"
      on:click={() => selectedCategory = 'quran'}
    >
      Quran Notes
    </button>
    <button 
      class="category-btn {selectedCategory === 'dua' ? 'active' : ''}"
      on:click={() => selectedCategory = 'dua'}
    >
      Duas & Dhikr
    </button>
  </div>

  <div class="entries-list">
    {#each demoEntries.filter(entry => selectedCategory === 'all' || entry.category === selectedCategory) as entry}
      <div class="entry-card">
        <div class="entry-header">
          <div class="entry-meta">
            <span class="entry-date">
              {new Date(entry.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </span>
            <span class="entry-category">{entry.category}</span>
          </div>
          <h3 class="entry-title">{entry.title}</h3>
        </div>
        <p class="entry-content">{entry.content}</p>
        <div class="entry-tags">
          {#each entry.tags as tag}
            <span class="tag">#{tag}</span>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .journal-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 1.5rem;
  }

  .journal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  h2 {
    font-size: 1.25rem;
    color: #216974;
    font-weight: 500;
  }

  .new-entry-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: #216974;
    color: white;
    border: none;
    padding: 0.75rem 1.25rem;
    border-radius: 8px;
    cursor: pointer;
  }

  .categories {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
    overflow-x: auto;
    padding-bottom: 0.5rem;
  }

  .category-btn {
    white-space: nowrap;
    padding: 0.5rem 1rem;
    border: 1px solid #eee;
    border-radius: 20px;
    background: white;
    color: #666;
    cursor: pointer;
  }

  .category-btn.active {
    background: #216974;
    color: white;
    border-color: #216974;
  }

  .entries-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .entry-card {
    background: white;
    padding: 1.5rem;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .entry-header {
    margin-bottom: 1rem;
  }

  .entry-meta {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }

  .entry-date {
    color: #666;
    font-size: 0.875rem;
  }

  .entry-category {
    color: #216974;
    font-size: 0.875rem;
    text-transform: capitalize;
  }

  .entry-title {
    font-size: 1.125rem;
    color: #333;
    margin: 0;
  }

  .entry-content {
    color: #666;
    line-height: 1.6;
    margin-bottom: 1rem;
  }

  .entry-tags {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .tag {
    font-size: 0.75rem;
    color: #216974;
    background: rgba(33, 105, 116, 0.1);
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
  }
</style> 