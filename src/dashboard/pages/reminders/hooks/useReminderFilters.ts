import { useState, useCallback } from 'react';
import type { Reminder } from '@/types';
import { priorityOrder } from '../helpers';
import type { FilterStatus, FilterRecurrence, FilterCategory, FilterPriority, SortMode, GroupMode, ViewMode } from '../types';

const LS_KEY = 'agentin:reminders:filters';
const loadFilters = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}'); } catch { return {}; } };
const persist = (u: Record<string, string>) => localStorage.setItem(LS_KEY, JSON.stringify({ ...loadFilters(), ...u }));

export function useReminderFilters(reminders: Reminder[]) {
  const saved = loadFilters();
  const [filter,           setFilterRaw]          = useState<FilterStatus>(saved.filter ?? 'all');
  const [recurrenceFilter, setRecurrenceFilterRaw] = useState<FilterRecurrence>(saved.recurrenceFilter ?? 'all');
  const [categoryFilter,   setCategoryFilterRaw]   = useState<FilterCategory>(saved.categoryFilter ?? 'all');
  const [priorityFilter,   setPriorityFilterRaw]   = useState<FilterPriority>(saved.priorityFilter ?? 'all');
  const [searchQuery,      setSearchQueryRaw]      = useState<string>(saved.searchQuery ?? '');
  const [sortMode,         setSortModeRaw]         = useState<SortMode>(saved.sortMode ?? 'priority');
  const [groupMode,        setGroupMode]           = useState<GroupMode>(saved.groupMode ?? 'date');
  const [viewMode,         setViewMode]            = useState<ViewMode>(saved.viewMode ?? 'list');

  const setFilter           = useCallback((v: FilterStatus)     => { setFilterRaw(v);           persist({ filter: v }); }, []);
  const setRecurrenceFilter = useCallback((v: FilterRecurrence) => { setRecurrenceFilterRaw(v); persist({ recurrenceFilter: v }); }, []);
  const setCategoryFilter   = useCallback((v: FilterCategory)   => { setCategoryFilterRaw(v);   persist({ categoryFilter: v }); }, []);
  const setPriorityFilter   = useCallback((v: FilterPriority)   => { setPriorityFilterRaw(v);   persist({ priorityFilter: v }); }, []);
  const setSearchQuery      = useCallback((v: string)           => { setSearchQueryRaw(v);       persist({ searchQuery: v }); }, []);
  const setSortMode         = useCallback((v: SortMode)         => { setSortModeRaw(v);          persist({ sortMode: v }); }, []);
  const clearFilters        = useCallback(() => {
    setFilterRaw('all'); setRecurrenceFilterRaw('all'); setCategoryFilterRaw('all');
    setPriorityFilterRaw('all'); setSearchQueryRaw('');
    localStorage.setItem(LS_KEY, '{}');
  }, []);

  const now = Date.now();
  const baseFiltered = reminders
    .filter(r => recurrenceFilter === 'recurring' ? !!r.recurrence : recurrenceFilter === 'one-off' ? !r.recurrence : true)
    .filter(r => categoryFilter !== 'all' ? r.category === categoryFilter : true)
    .filter(r => priorityFilter !== 'all' ? (r.priority ?? 'normal') === priorityFilter : true)
    .filter(r => r.text.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const aOver = !a.completed && new Date(a.datetime).getTime() < now;
      const bOver = !b.completed && new Date(b.datetime).getTime() < now;
      if (aOver && !bOver) return -1;
      if (!aOver && bOver) return 1;
      if (sortMode === 'due') return new Date(a.datetime).getTime() - new Date(b.datetime).getTime();
      return (priorityOrder[a.priority ?? 'normal'] ?? 2) - (priorityOrder[b.priority ?? 'normal'] ?? 2);
    });

  const showActive    = filter === 'active'    || filter === 'all';
  const showCompleted = filter === 'completed' || filter === 'all';
  const activeFiltered    = showActive    ? baseFiltered.filter(r => !r.completed) : [];
  const completedFiltered = showCompleted ? baseFiltered.filter(r =>  r.completed) : [];
  const isEmpty           = activeFiltered.length === 0 && completedFiltered.length === 0;
  const hasActiveFilters  = filter !== 'all' || categoryFilter !== 'all' || priorityFilter !== 'all' || recurrenceFilter !== 'all' || searchQuery !== '';

  return {
    filter, recurrenceFilter, categoryFilter, priorityFilter, searchQuery, sortMode, groupMode, viewMode,
    setFilter, setRecurrenceFilter, setCategoryFilter, setPriorityFilter,
    setSearchQuery, setSortMode, setGroupMode, setViewMode, clearFilters,
    showActive, showCompleted, activeFiltered, completedFiltered, isEmpty, hasActiveFilters,
  };
}
