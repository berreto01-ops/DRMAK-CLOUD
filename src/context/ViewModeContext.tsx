'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo, ReactNode } from 'react';
import { useAuth } from '@/firebase';
import { onAuthStateChanged } from 'firebase/auth';

type ViewMode = 'none' | 'organization' | 'clinic' | 'reports';

interface ViewModeContextType {
    viewMode: ViewMode;
    setViewMode: (mode: ViewMode) => void;
}

const ViewModeContext = createContext<ViewModeContextType | undefined>(undefined);

const VIEW_MODE_KEY = 'admin_view_mode';

export function ViewModeProvider({ children }: { children: ReactNode }) {
    const [viewMode, setViewModeState] = useState<ViewMode>(() => {
        // Restore saved view mode from localStorage immediately on first render
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem(VIEW_MODE_KEY);
            if (stored === 'organization' || stored === 'clinic' || stored === 'reports') return stored;
        }
        // Default to 'reports' for main admin on first login
        return 'reports';
    });

    const auth = useAuth();
    // Track whether we have ever seen an authenticated user in this session
    const hadUserRef = useRef(false);

    useEffect(() => {
        if (!auth) return;
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                // User is authenticated — mark that we've seen a real user
                hadUserRef.current = true;
            } else if (hadUserRef.current) {
                // We previously had a user and now we don't — this is a real logout
                hadUserRef.current = false;
                localStorage.removeItem(VIEW_MODE_KEY);
                setViewModeState('none');
            }
            // If hadUserRef.current is false and user is null — this is the cold-start null
            // that Firebase fires before resolving the persisted session. Ignore it.
        });
        return () => unsubscribe();
    }, [auth]);

    const setViewMode = useCallback((mode: ViewMode) => {
        setViewModeState(mode);
        if (typeof window !== 'undefined') {
            if (mode === 'none') {
                localStorage.removeItem(VIEW_MODE_KEY);
            } else {
                localStorage.setItem(VIEW_MODE_KEY, mode);
            }
        }
    }, []);

    const value = useMemo(() => ({ viewMode, setViewMode }), [viewMode, setViewMode]);

    return (
        <ViewModeContext.Provider value={value}>
            {children}
        </ViewModeContext.Provider>
    );
}

export function useViewMode() {
    const context = useContext(ViewModeContext);
    if (context === undefined) {
        throw new Error('useViewMode must be used within a ViewModeProvider');
    }
    return context;
}
