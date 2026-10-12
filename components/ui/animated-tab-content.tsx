'use client';

import React, { useRef, useState, useLayoutEffect, useEffect } from 'react';

interface AnimatedTabContentProps {
  activeKey: string;
  children: React.ReactNode;
  className?: string;
  duration?: number;
}

/**
 * AnimatedTabContent
 * Smoothly expands and shrinks container height when switching tabs,
 * eliminating sudden blips / layout snaps. Also coordinates a subtle
 * fade-in for tab contents while respecting prefers-reduced-motion.
 */
export function AnimatedTabContent({
  activeKey,
  children,
  className = '',
  duration = 300,
}: AnimatedTabContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const previousHeightRef = useRef<number | null>(null);
  const isTransitioningRef = useRef(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const isInitialMount = useRef(true);

  // Check prefers-reduced-motion
  const prefersReducedMotion = useRef(false);
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion.current = mql.matches;
    const handler = (e: MediaQueryListEvent) => {
      prefersReducedMotion.current = e.matches;
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Continually track content height when idle via ResizeObserver
  useEffect(() => {
    if (!contentRef.current) return;
    const observer = new ResizeObserver(() => {
      if (!isTransitioningRef.current && contentRef.current) {
        previousHeightRef.current = contentRef.current.offsetHeight;
      }
    });

    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!contentRef.current || !containerRef.current) return;

    const newHeight = contentRef.current.offsetHeight;

    // Reset scroll of any scrollable container so user starts at top of tab
    const scrollParent = containerRef.current.closest('.overflow-y-auto');
    if (scrollParent) {
      scrollParent.scrollTop = 0;
    }

    if (isInitialMount.current) {
      isInitialMount.current = false;
      previousHeightRef.current = newHeight;
      return;
    }

    const container = containerRef.current;
    // If mid-transition, catch from the visual height; otherwise use previous tab's idle height
    const prevHeight = isTransitioningRef.current
      ? container.getBoundingClientRect().height
      : previousHeightRef.current;

    previousHeightRef.current = newHeight;

    if (
      prefersReducedMotion.current ||
      !prevHeight ||
      Math.abs(prevHeight - newHeight) < 4
    ) {
      return;
    }

    isTransitioningRef.current = true;
    setIsTransitioning(true);

    // 1. Instantly pin to starting height with zero transition to prevent any blip
    container.style.height = `${prevHeight}px`;
    container.style.transition = 'none';
    container.style.overflow = 'hidden';
    container.style.willChange = 'height';

    // 2. Force reflow so the browser commits the starting height
    void container.offsetHeight;

    // 3. Trigger transition to newHeight on next frame
    let timerId: NodeJS.Timeout;

    const animId = requestAnimationFrame(() => {
      container.style.transition = `height ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
      container.style.height = `${newHeight}px`;

      timerId = setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.style.height = '';
          containerRef.current.style.transition = '';
          containerRef.current.style.overflow = '';
          containerRef.current.style.willChange = '';
          isTransitioningRef.current = false;
          setIsTransitioning(false);
        }
      }, duration + 40);
    });

    return () => {
      cancelAnimationFrame(animId);
      clearTimeout(timerId);
    };
  }, [activeKey, duration]);

  return (
    <div
      ref={containerRef}
      className={`w-full ${isTransitioning ? 'overflow-hidden' : ''} ${className}`}
    >
      <div
        ref={contentRef}
        key={activeKey}
        className="animate-tab-enter"
      >
        {children}
      </div>
    </div>
  );
}
