// src/hooks/useLocalLabels.js
import { useState, useEffect } from 'react';

const LABELS_KEY   = 'ms_labels';       // all label definitions
const APPLIED_KEY  = 'ms_applied';      // which labels applied to which email

const DEFAULT_COLORS = [
    '#1D9E75', '#4A6FA5', '#C43030',
    '#F59E0B', '#8B5CF6', '#EC4899',
    '#14B8A6', '#F97316',
];

export function useLocalLabels() {
    // All label definitions: [{id, name, color}]
    const [labels, setLabels] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem(LABELS_KEY)) ?? [];
        } catch { return []; }
    });

    // Applied: { emailId: [labelId, labelId] }
    const [applied, setApplied] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem(APPLIED_KEY)) ?? {};
        } catch { return {}; }
    });

    // Persist to localStorage whenever state changes
    useEffect(() => {
        localStorage.setItem(LABELS_KEY, JSON.stringify(labels));
    }, [labels]);

    useEffect(() => {
        localStorage.setItem(APPLIED_KEY, JSON.stringify(applied));
    }, [applied]);

    // Create a new label
    function createLabel(name, color) {
        if (!name.trim()) return;
        const colorPick = color ?? DEFAULT_COLORS[labels.length % DEFAULT_COLORS.length];
        const newLabel  = {
            id:    Date.now().toString(),
            name:  name.trim(),
            color: colorPick,
        };
        setLabels(prev => [...prev, newLabel]);
        return newLabel;
    }

    // Delete a label definition + remove from all emails
    function deleteLabel(labelId) {
        setLabels(prev => prev.filter(l => l.id !== labelId));
        setApplied(prev => {
            const updated = { ...prev };
            Object.keys(updated).forEach(emailId => {
                updated[emailId] = updated[emailId].filter(id => id !== labelId);
            });
            return updated;
        });
    }

    // Apply label to email
    function applyLabel(emailId, labelId) {
        setApplied(prev => {
            const current = prev[emailId] ?? [];
            if (current.includes(labelId)) return prev;
            return { ...prev, [emailId]: [...current, labelId] };
        });
    }

    // Remove label from email
    function removeLabel(emailId, labelId) {
        setApplied(prev => ({
            ...prev,
            [emailId]: (prev[emailId] ?? []).filter(id => id !== labelId),
        }));
    }

    // Get labels applied to a specific email
    function getEmailLabels(emailId) {
        const appliedIds = applied[emailId] ?? [];
        return labels.filter(l => appliedIds.includes(l.id));
    }

    return {
        labels,
        createLabel,
        deleteLabel,
        applyLabel,
        removeLabel,
        getEmailLabels,
    };
}