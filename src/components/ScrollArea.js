'use client';

import { useEffect, useRef, useState } from 'react';
import './ScrollArea.css';

// Horizontally scrolling box with ‹ › buttons on both sides, each shown only
// while there is more to see that way: a mouse without a sideways wheel can
// still get to the hidden part. `className` goes on the scrolling element
// (an `as` element, div by default), `outerClassName` on the wrapper; `ref`
// reaches the scrolling element.
export default function ScrollArea({ ref, as: Box = 'div', className, outerClassName = '', children, ...props }) {
  const box = useRef(null);
  const [more, setMore] = useState({ prev: false, next: false, tall: false });

  useEffect(() => {
    const el = box.current;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      // Taller than the screen (a long table): the buttons follow the middle of the screen.
      setMore({ prev: el.scrollLeft > 2, next: el.scrollLeft < max - 2, tall: el.clientHeight > window.innerHeight * 0.8 });
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    // Size changes of the box and content added later (e.g. days loaded after the page).
    const resize = new ResizeObserver(update);
    resize.observe(el);
    const mutations = new MutationObserver(update);
    mutations.observe(el, { childList: true, subtree: true });
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      resize.disconnect();
      mutations.disconnect();
    };
  }, []);

  function setRef(node) {
    box.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  }

  // A strip of snapping cards moves by a whole view (the next set of whole
  // cards); a table by most of one, keeping a little of what was on screen.
  function scroll(direction) {
    const el = box.current;
    const snaps = getComputedStyle(el).scrollSnapType.startsWith('x');
    el.scrollBy({ left: direction * el.clientWidth * (snaps ? 1 : 0.8), behavior: 'smooth' });
  }

  return (
    <div className={`scroll-area${more.tall ? ' is-tall' : ''} ${outerClassName}`.trim()}>
      <div className="scroll-rail scroll-rail-prev" hidden={!more.prev}>
        <button type="button" className="scroll-btn" aria-label="Зүүн тийш гүйлгэх" onClick={() => scroll(-1)}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <Box ref={setRef} className={className} {...props}>
        {children}
      </Box>
      <div className="scroll-rail scroll-rail-next" hidden={!more.next}>
        <button type="button" className="scroll-btn" aria-label="Баруун тийш гүйлгэх" onClick={() => scroll(1)}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
