import React from 'react';

interface VoiceVisualizerProps {
  isListening: boolean;
  isSpeaking: boolean;
}

export const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({ isListening, isSpeaking }) => {
  if (!isListening && !isSpeaking) return null;

  return (
    <div className="flex items-center gap-1 h-5 px-2">
      {[40, 75, 100, 60, 90, 45, 80].map((height, i) => (
        <span
          key={i}
          className={`w-1 rounded-full transition-all duration-300 ${
            isListening ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500 animate-bounce'
          }`}
          style={{
            height: `${height}%`,
            animationDelay: `${i * 120}ms`,
            animationDuration: isListening ? '600ms' : '800ms',
          }}
        />
      ))}
    </div>
  );
};
