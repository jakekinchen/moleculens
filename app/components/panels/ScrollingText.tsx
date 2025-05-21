import React, { useRef, useEffect, useState } from 'react';
import styles from './ScrollingText.module.css';

interface ScrollingTextProps {
  text: string;
  className?: string;
}

const ScrollingText: React.FC<ScrollingTextProps> = ({ text, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [animationDuration, setAnimationDuration] = useState('20s');

  useEffect(() => {
    const checkOverflowAndSetDuration = () => {
      if (containerRef.current && textRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const textWidth = textRef.current.scrollWidth;
        const newIsOverflowing = textWidth > containerWidth;
        setIsOverflowing(newIsOverflowing);

        if (newIsOverflowing) {
          // Adjust the divisor (e.g., 40) to control speed. Lower = faster.
          const duration = Math.max(5, textWidth / 40); // Min duration 5s
          setAnimationDuration(`${duration}s`);
        }
      }
    };

    checkOverflowAndSetDuration();
    // Debounce or throttle if performance becomes an issue with frequent resizes
    window.addEventListener('resize', checkOverflowAndSetDuration);
    return () => window.removeEventListener('resize', checkOverflowAndSetDuration);
  }, [text]);

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${className || ''}`}
    >
      <span
        ref={textRef}
        className={`${styles.span} ${isOverflowing ? styles.animate : ''}`}
        style={isOverflowing ? { animationDuration } : {}}
      >
        {text}
      </span>
      {isOverflowing && (
        <span
          aria-hidden="true"
          className={`${styles.span} ${styles.animate} ${styles.duplicate}`}
          style={{ animationDuration }}
        >
          {text}
        </span>
      )}
    </div>
  );
};

export default ScrollingText; 
