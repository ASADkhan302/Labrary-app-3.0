/**
 * Universal Button Micro-Interaction & Ripple Animation Engine
 * Automatically attaches tactile ripple waves and audio feedback to all interactive buttons.
 */
import { playClickSound } from '../services/audio';

export function initButtonRippleEngine(): () => void {
  const handlePointerDown = (event: PointerEvent) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const button = target.closest('button, [role="button"], .btn-interactive') as HTMLElement | null;
    if (!button) return;

    // Skip label elements, file triggers, disabled elements or elements with .no-anim
    if (
      button.tagName === 'LABEL' ||
      button.hasAttribute('for') ||
      button.hasAttribute('disabled') || 
      button.getAttribute('aria-disabled') === 'true' ||
      button.classList.contains('no-anim')
    ) {
      return;
    }

    // Play tactile soft click audio feedback
    try {
      playClickSound();
    } catch {
      // Audio autoplay policy fallback
    }

    const rect = button.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    // Calculate click coordinates relative to button
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Determine diameter to cover the furthest corner
    const diameter = Math.max(rect.width, rect.height) * 2;
    const radius = diameter / 2;

    const isLight = document.documentElement.classList.contains('light') || document.body.classList.contains('light');
    const rippleColor = isLight ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.2)';

    // Ensure button has positioning context
    const computedPosition = window.getComputedStyle(button).position;
    if (computedPosition === 'static') {
      button.style.position = 'relative';
    }
    
    // Create ripple element
    const ripple = document.createElement('span');
    ripple.className = 'btn-ripple-wave';
    ripple.style.position = 'absolute';
    ripple.style.width = `${diameter}px`;
    ripple.style.height = `${diameter}px`;
    ripple.style.left = `${x - radius}px`;
    ripple.style.top = `${y - radius}px`;
    ripple.style.borderRadius = '50%';
    ripple.style.backgroundColor = rippleColor;
    ripple.style.pointerEvents = 'none';
    ripple.style.transform = 'scale(0)';
    ripple.style.opacity = '1';
    ripple.style.transition = 'transform 400ms cubic-bezier(0.16, 1, 0.3, 1), opacity 400ms ease-out';
    ripple.style.zIndex = '10';

    button.appendChild(ripple);

    // Trigger animation in next frame
    requestAnimationFrame(() => {
      ripple.style.transform = 'scale(1)';
      ripple.style.opacity = '0';
    });

    // Cleanup after animation completes (400ms)
    setTimeout(() => {
      if (ripple.parentNode === button) {
        button.removeChild(ripple);
      }
    }, 450);
  };

  document.addEventListener('pointerdown', handlePointerDown, { passive: true });

  return () => {
    document.removeEventListener('pointerdown', handlePointerDown);
  };
}
