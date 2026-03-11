import { useEffect, useRef } from 'react';

interface UseSwipeToDismissProps {
    onDismiss: () => void;
    enabled?: boolean;
    // Edge width from what a swipe is allowed to start
    edgeWidth?: number;
    // How fast the swipe must be to count as a dismiss
    velocityThreshold?: number;
    // How far the swipe must be to count as a dismiss (without high velocity)
    distanceThreshold?: number;
    // Ref to the actual modal container that will slide
    modalRef: React.RefObject<HTMLDivElement>;
    // Ref to the backdrop container that will fade
    backdropRef?: React.RefObject<HTMLDivElement>;
}

export function useSwipeToDismiss({
    onDismiss,
    enabled = true,
    edgeWidth = 40,
    velocityThreshold = 0.5,
    distanceThreshold = 0.4,
    modalRef,
    backdropRef
}: UseSwipeToDismissProps) {
    const startX = useRef<number | null>(null);
    const startY = useRef<number | null>(null);
    const lastX = useRef<number | null>(null);
    const lastTime = useRef<number | null>(null);
    const isSwiping = useRef(false);
    const modalWidth = useRef<number>(0);

    useEffect(() => {
        if (!enabled || !modalRef.current) return;

        const modal = modalRef.current;
        const backdrop = backdropRef?.current;

        const resetState = (mod: HTMLDivElement, back?: HTMLDivElement, clearTransform = false) => {
            if (clearTransform) {
                mod.style.transform = '';
                mod.style.transition = '';
                if (back) {
                    back.style.opacity = '';
                    back.style.transition = '';
                }
            }
            startX.current = null;
            startY.current = null;
            lastX.current = null;
            lastTime.current = null;
            isSwiping.current = false;
        };

        const handleTouchStart = (e: TouchEvent) => {
            if (e.touches.length > 1) return; // Ignore multi-touch

            const touch = e.touches[0];

            // Only start if touch is near the left edge
            if (touch.clientX > edgeWidth) return;

            startX.current = touch.clientX;
            startY.current = touch.clientY;
            lastX.current = touch.clientX;
            lastTime.current = Date.now();
            isSwiping.current = false;
            modalWidth.current = modal.offsetWidth;

            // Remove CSS transitions during the drag for instant 1:1 feel
            modal.style.transition = 'none';
            if (backdrop) {
                backdrop.style.transition = 'none';
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (startX.current === null || startY.current === null) return;

            const touch = e.touches[0];
            const currentX = touch.clientX;
            const currentY = touch.clientY;

            const deltaX = currentX - startX.current;
            const deltaY = currentY - startY.current;

            // If we're moving mostly vertically early on, cancel the swipe detection
            if (!isSwiping.current && Math.abs(deltaY) > Math.abs(deltaX)) {
                resetState(modal, backdrop);
                return;
            }

            // Lock in the swipe
            if (deltaX > 0) {
                isSwiping.current = true;

                // Prevent vertical scrolling while swiping horizontally
                e.preventDefault();

                // Apply the transform
                modal.style.transform = `translateX(${deltaX}px)`;

                // Apply backdrop fade
                if (backdrop && modalWidth.current > 0) {
                    const progress = Math.min(deltaX / modalWidth.current, 1);
                    backdrop.style.opacity = `${1 - progress}`;
                }

                lastX.current = currentX;
                lastTime.current = Date.now();
            }
        };

        const handleTouchEnd = (e: TouchEvent) => {
            if (startX.current === null || lastX.current === null || lastTime.current === null || !isSwiping.current) {
                resetState(modal, backdrop);
                return;
            }

            const touch = e.changedTouches[0];
            const endX = touch.clientX;
            const now = Date.now();

            const deltaX = endX - startX.current;
            const timeDiff = now - lastTime.current;
            const recentDist = endX - lastX.current;

            // Velocity = pixels per ms
            const velocity = timeDiff > 0 ? recentDist / timeDiff : 0;

            // We use standard React CSS transitions for the bounce back
            modal.style.transition = 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)';
            if (backdrop) {
                backdrop.style.transition = 'opacity 0.3s ease-out';
            }

            // Decide whether to dismiss or snap back
            const distanceRatio = deltaX / (modalWidth.current || window.innerWidth);

            if (velocity > velocityThreshold || (distanceRatio > distanceThreshold && velocity > -0.1)) {
                // Animate out completely
                modal.style.transform = 'translateX(100%)';
                if (backdrop) {
                    backdrop.style.opacity = '0';
                }

                // Wait for animation frame, then trigger dismiss
                setTimeout(() => {
                    onDismiss();
                }, 300);
            } else {
                // Snap back
                modal.style.transform = 'translateX(0)';
                if (backdrop) {
                    backdrop.style.opacity = '1';
                }
                setTimeout(() => {
                    resetState(modal, backdrop, true);
                }, 300);
            }

            // Clear refs
            startX.current = null;
            startY.current = null;
            lastX.current = null;
            lastTime.current = null;
            isSwiping.current = false;
        };

        // Handlers attached at end

        // Add event listeners (passive: false for touchmove is important to allow e.preventDefault())
        modal.addEventListener('touchstart', handleTouchStart, { passive: true });
        modal.addEventListener('touchmove', handleTouchMove, { passive: false });
        modal.addEventListener('touchend', handleTouchEnd, { passive: true });
        modal.addEventListener('touchcancel', handleTouchEnd, { passive: true });

        return () => {
            modal.removeEventListener('touchstart', handleTouchStart);
            modal.removeEventListener('touchmove', handleTouchMove);
            modal.removeEventListener('touchend', handleTouchEnd);
            modal.removeEventListener('touchcancel', handleTouchEnd);
        };
    }, [enabled, onDismiss, edgeWidth, velocityThreshold, distanceThreshold]);
}
