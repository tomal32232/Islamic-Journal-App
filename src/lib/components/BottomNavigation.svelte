<style>
  .nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
    color: #666;
    text-decoration: none;
    transition: all 0.2s ease;
    flex: 1;
    min-width: 0;
    outline: none !important;
    -webkit-tap-highlight-color: transparent;
  }

  .nav-item:focus {
    outline: none;
    box-shadow: none;
  }

  .nav-item:focus-visible {
    outline: none;
    box-shadow: none;
  }

  .nav-item.active {
    color: #216974;
  }

  .nav-item:hover {
    color: #216974;
  }

  .nav-label {
    font-size: 0.75rem;
    margin-top: 0.25rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
</style> 