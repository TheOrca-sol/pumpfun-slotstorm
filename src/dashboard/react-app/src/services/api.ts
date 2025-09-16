const API_BASE = 'http://localhost:3002/api';

export const API = {
  async getSniperStats() {
    const response = await fetch(`${API_BASE}/sniper/stats`);
    return response.json();
  },

  async getRecentTokens(limit = 20) {
    const response = await fetch(`${API_BASE}/sniper/tokens?limit=${limit}`);
    return response.json();
  },

  async getSniperAlerts(limit = 10, minScore = 0) {
    const response = await fetch(`${API_BASE}/sniper/alerts?limit=${limit}&minScore=${minScore}`);
    return response.json();
  },

  async getTopWhales(limit = 10) {
    const response = await fetch(`${API_BASE}/sniper/whales?limit=${limit}`);
    return response.json();
  },

  async getSniperActivity(limit = 50) {
    const response = await fetch(`${API_BASE}/sniper/activity?limit=${limit}`);
    return response.json();
  },

  async getMarketStats() {
    const response = await fetch(`${API_BASE}/market/stats`);
    return response.json();
  },

  async getTokenAlert(mint: string) {
    const response = await fetch(`${API_BASE}/sniper/token/${mint}`);
    return response.json();
  }
};