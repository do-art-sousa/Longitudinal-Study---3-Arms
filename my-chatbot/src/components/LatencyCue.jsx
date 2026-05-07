import React, { useState, useEffect } from 'react';
import '../styles/LatencyCue.css';

/**
 * LatencyCue Component
 * Shows a short “writing…” cue if the AI response takes longer than 2 seconds.
 */
export default function LatencyCue({ isWaiting }) {
  const [showCue, setShowCue] = useState(false);

  useEffect(() => {
    if (!isWaiting) {
      setShowCue(false);
      return;
    }

    const timer = setTimeout(() => {
      setShowCue(true);
    }, 2000); // Show cue after 2 seconds

    return () => clearTimeout(timer);
  }, [isWaiting]);

  if (!isWaiting || !showCue) {
    return null;
  }

  return (
    <div className="latency-cue">
      <p>A escrever...</p>
    </div>
  );
}
