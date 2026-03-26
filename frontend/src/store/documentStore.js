import { create } from 'zustand';
import { documentsAPI } from '../services/api';

export const useDocumentStore = create((set, get) => ({
  documents: [],
  currentDoc: null,
  loading: false,
  error: null,

  async fetchDocuments() {
    set({ loading: true, error: null });
    try {
      const res = await documentsAPI.list();
      set({ documents: res.data.data || [], loading: false });
    } catch (e) {
      set({ error: e.message, loading: false });
    }
  },

  async fetchDocument(id) {
    set({ loading: true, error: null });
    try {
      const res = await documentsAPI.get(id);
      set({ currentDoc: res.data.data, loading: false });
      return res.data.data;
    } catch (e) {
      set({ error: e.message, loading: false });
      return null;
    }
  },

  async createDocument(title = 'Untitled Document') {
    try {
      const res = await documentsAPI.create({ title });
      const newDoc = res.data.data;
      set((s) => ({ documents: [newDoc, ...s.documents] }));
      return newDoc;
    } catch (e) {
      set({ error: e.message });
      return null;
    }
  },

  async deleteDocument(id) {
    try {
      await documentsAPI.delete(id);
      set((s) => ({
        documents: s.documents.filter((d) => d.id !== id),
      }));
    } catch (e) {
      set({ error: e.message });
    }
  },

  setCurrentDoc(doc) {
    set({ currentDoc: doc });
  },

  clearCurrentDoc() {
    set({ currentDoc: null });
  },
}));
