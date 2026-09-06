"use client";

import { useCallback, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";

type TabId = string;

/**
 * WAI-ARIA manual-activation tab focus.
 *
 * Arrow/Home/End keys only move DOM focus. Native button Enter/Space behavior
 * remains responsible for activation, so a tab can receive focus without
 * immediately replacing a potentially expensive panel.
 */
export function useManualTabFocus<T extends TabId>(tabIds: readonly T[], activeTabId: T) {
  const [focusedTabId, setFocusedTabId] = useState<T>(activeTabId);
  const tabRefs = useRef(new Map<T, HTMLButtonElement>());

  const registerTab = useCallback((tabId: T) => (element: HTMLButtonElement | null) => {
    if (element) tabRefs.current.set(tabId, element);
    else tabRefs.current.delete(tabId);
  }, []);

  const onTabFocus = useCallback((tabId: T) => setFocusedTabId(tabId), []);

  // With manual activation, arrow navigation may leave focus on an unselected
  // tab. Once the user leaves the tablist, make the selected tab the single
  // Tab stop again, as specified by the ARIA Tabs pattern.
  const onTabBlur = useCallback((event: FocusEvent<HTMLButtonElement>) => {
    const nextElement = event.relatedTarget as HTMLElement | null;
    const staysInThisTablist = Array.from(tabRefs.current.values()).includes(nextElement as HTMLButtonElement);
    if (!staysInThisTablist) setFocusedTabId(activeTabId);
  }, [activeTabId]);

  const onTabKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>) => {
    const currentTabId = event.currentTarget.dataset.tabId as T | undefined;
    if (!currentTabId) return;

    const currentIndex = tabIds.indexOf(currentTabId);
    if (currentIndex < 0) return;

    let nextIndex: number | null = null;
    switch (event.key) {
      case "ArrowRight":
        nextIndex = (currentIndex + 1) % tabIds.length;
        break;
      case "ArrowLeft":
        nextIndex = (currentIndex - 1 + tabIds.length) % tabIds.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = tabIds.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextTabId = tabIds[nextIndex];
    setFocusedTabId(nextTabId);
    tabRefs.current.get(nextTabId)?.focus();
  }, [tabIds]);

  const tabStopId = tabIds.includes(focusedTabId) ? focusedTabId : activeTabId;
  return { focusedTabId: tabStopId, registerTab, onTabFocus, onTabBlur, onTabKeyDown };
}
