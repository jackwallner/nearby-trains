/**
 * Feature Request Module
 * Posts feature requests to Discord via webhook
 * Same pattern as overhead-flights
 */

const FeatureRequest = {
  WEBHOOK_URL: 'https://discord.com/api/webhooks/1467631595245535406/sUgNUZ97f3TgAGRfg1MUbbHXUTLJfz2TKhLAq3wp_hCQ9wyYnYdegImuwnCrUIYqeof5',
  STORAGE_KEY: 'nt_pending_features',
  isOpen: false,

  /**
   * Open the feature request modal
   */
  open() {
    const modal = document.getElementById('feature-request-modal');
    if (modal) {
      modal.classList.remove('hidden');
      this.isOpen = true;
      setTimeout(() => document.getElementById('fr-title')?.focus(), 50);
    }
  },

  /**
   * Close the feature request modal
   */
  close() {
    const modal = document.getElementById('feature-request-modal');
    if (modal) {
      modal.classList.add('hidden');
      this.isOpen = false;
      // Clear form
      const title = document.getElementById('fr-title');
      const desc = document.getElementById('fr-description');
      const priority = document.getElementById('fr-priority');
      if (title) title.value = '';
      if (desc) desc.value = '';
      if (priority) priority.value = 'medium';
    }
  },

  /**
   * Submit the feature request to Discord
   */
  async submit() {
    const title = document.getElementById('fr-title')?.value.trim();
    const description = document.getElementById('fr-description')?.value.trim();
    const priority = document.getElementById('fr-priority')?.value || 'medium';

    if (!title) {
      UI.showToast('Please enter a title for your request', 'error');
      return;
    }

    const submitBtn = document.getElementById('fr-submit');
    if (submitBtn) {
      submitBtn.textContent = 'Sending...';
      submitBtn.disabled = true;
    }

    const priorityEmoji = { low: '🟢', medium: '🟡', high: '🔴' };

    const payload = {
      embeds: [{
        title: `💡 Feature Request: ${title}`,
        description: description || '_No description provided_',
        color: priority === 'high' ? 0xdc2626 : priority === 'medium' ? 0xf59e0b : 0x16a34a,
        fields: [
          { name: 'Priority', value: `${priorityEmoji[priority] || '🟡'} ${priority.charAt(0).toUpperCase() + priority.slice(1)}`, inline: true },
          { name: 'Source', value: '🚂 Dick Wallner Train Tracker', inline: true }
        ],
        footer: { text: `Submitted ${new Date().toLocaleString()}` }
      }]
    };

    try {
      const response = await fetch(this.WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok || response.status === 204) {
        UI.showToast('Feature request submitted! Thanks! 🎉', 'success');
        this.close();
      } else {
        throw new Error(`Discord returned ${response.status}`);
      }
    } catch (error) {
      console.error('Feature request failed:', error);
      // Save to localStorage for retry
      this.savePending({ title, description, priority, timestamp: Date.now() });
      UI.showToast('Saved locally — will retry when online', 'info');
      this.close();
    }

    if (submitBtn) {
      submitBtn.textContent = '🚀 Submit Request';
      submitBtn.disabled = false;
    }
  },

  /**
   * Save a pending request to localStorage
   */
  savePending(request) {
    try {
      const pending = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
      pending.push(request);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(pending));
    } catch (e) {
      console.warn('Could not save pending request:', e);
    }
  },

  /**
   * Retry any pending requests
   */
  async retryPending() {
    try {
      const pending = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
      if (pending.length === 0) return;

      const remaining = [];
      for (const req of pending) {
        try {
          const priorityEmoji = { low: '🟢', medium: '🟡', high: '🔴' };
          const payload = {
            embeds: [{
              title: `💡 Feature Request: ${req.title}`,
              description: req.description || '_No description provided_',
              color: req.priority === 'high' ? 0xdc2626 : req.priority === 'medium' ? 0xf59e0b : 0x16a34a,
              fields: [
                { name: 'Priority', value: `${priorityEmoji[req.priority] || '🟡'} ${req.priority.charAt(0).toUpperCase() + req.priority.slice(1)}`, inline: true },
                { name: 'Source', value: '🚂 Dick Wallner Train Tracker', inline: true },
                { name: 'Originally Submitted', value: new Date(req.timestamp).toLocaleString(), inline: true }
              ],
              footer: { text: `Retried ${new Date().toLocaleString()}` }
            }]
          };

          const response = await fetch(this.WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (!response.ok && response.status !== 204) {
            remaining.push(req);
          }
        } catch {
          remaining.push(req);
        }
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(remaining));
    } catch (e) {
      console.warn('Retry pending failed:', e);
    }
  },

  /**
   * Bind all event handlers
   */
  init() {
    // Open button
    document.getElementById('btn-feature-request')?.addEventListener('click', () => this.open());

    // Close button
    document.getElementById('fr-close')?.addEventListener('click', () => this.close());

    // Submit button
    document.getElementById('fr-submit')?.addEventListener('click', () => this.submit());

    // Backdrop close
    document.getElementById('feature-request-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'feature-request-modal') this.close();
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close();
    });

    // Retry pending on load
    this.retryPending();
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  FeatureRequest.init();
});

window.FeatureRequest = FeatureRequest;
