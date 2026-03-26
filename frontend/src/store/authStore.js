import { create } from 'zustand';
import { connectSocket, disconnectSocket } from '../services/socket';

const TOKEN_KEY = 'collabdoc_token';
const USER_KEY  = 'collabdoc_user';

export const useAuthStore = create((set) => ({
  token: localStorage.getItem(TOKEN_KEY) || null,
  user:  JSON.parse(localStorage.getItem(USER_KEY) || 'null'),

  login(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    connectSocket(token);
    set({ token, user });
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    disconnectSocket();
    set({ token: null, user: null });
  },
}));
