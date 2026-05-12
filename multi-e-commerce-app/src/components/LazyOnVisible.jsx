import React, { useEffect, useRef, useState } from 'react';

const LazyOnVisible = ({ children, rootMargin = '300px 0px', fallback = null }) => {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || visible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin, visible]);

  return <div ref={ref}>{visible ? children : fallback}</div>;
};

export default LazyOnVisible;
