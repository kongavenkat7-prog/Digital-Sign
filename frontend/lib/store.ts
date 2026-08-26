import create from 'zustand';

interface Document {
  documentId: string;
  fileName: string;
  status: 'pending' | 'signed' | 'verified';
  createdAt: Date;
}

interface DigiSignStore {
  currentDocument: Document | null;
  documents: Document[];
  setCurrentDocument: (doc: Document | null) => void;
  addDocument: (doc: Document) => void;
  updateDocument: (documentId: string, updates: Partial<Document>) => void;
  getDocument: (documentId: string) => Document | undefined;
}

export const useDigiSignStore = create<DigiSignStore>((set, get) => ({
  currentDocument: null,
  documents: [],
  
  setCurrentDocument: (doc) => set({ currentDocument: doc }),
  
  addDocument: (doc) => set((state) => ({
    documents: [...state.documents, doc],
  })),
  
  updateDocument: (documentId, updates) => set((state) => ({
    documents: state.documents.map((doc) =>
      doc.documentId === documentId ? { ...doc, ...updates } : doc
    ),
  })),
  
  getDocument: (documentId) => {
    const state = get();
    return state.documents.find((doc) => doc.documentId === documentId);
  },
}));
