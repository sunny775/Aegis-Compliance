import { useReducedMotion, type Variants, type Transition } from 'framer-motion';

/**
 * Motion vocabulary: a calm ~200ms ease for route transitions and a staggered
 * entrance for lists. All of it collapses to instant when the user prefers
 * reduced motion.
 */

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

export function usePageTransition(): { variants: Variants; transition: Transition } {
  const reduced = useReducedMotion();
  return {
    variants: {
      initial: { opacity: 0, y: reduced ? 0 : 8 },
      enter: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: reduced ? 0 : -6 },
    },
    transition: { duration: reduced ? 0 : 0.2, ease: EASE },
  };
}

export function useStagger(): { container: Variants; item: Variants } {
  const reduced = useReducedMotion();
  return {
    container: {
      hidden: {},
      show: { transition: { staggerChildren: reduced ? 0 : 0.05, delayChildren: reduced ? 0 : 0.04 } },
    },
    item: {
      hidden: { opacity: 0, y: reduced ? 0 : 12 },
      show: { opacity: 1, y: 0, transition: { duration: reduced ? 0 : 0.32, ease: EASE } },
    },
  };
}
