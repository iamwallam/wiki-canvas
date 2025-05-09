"use client";
import { useState, useEffect } from 'react';

const UrlFormInput = ({ onSubmit, isLoading }) => {
  const [url, setUrl] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!url.trim() || isLoading) return;
    onSubmit(url);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4 w-full max-w-md">
      <div className="relative group w-full">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste any Wikipedia link"
          className="w-full px-4 py-3 rounded-lg border border-gray-600 bg-gray-800 text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-base"
          disabled={isLoading}
          aria-describedby="url-tooltip"
        />
        <div 
          id="url-tooltip"
          role="tooltip"
          className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 text-xs text-white bg-gray-700 rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-300 whitespace-nowrap shadow-lg"
        >
          e.g., https://en.wikipedia.org/wiki/React_(software)
          <div className="absolute left-1/2 transform -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-700"></div>
        </div>
      </div>
      <button 
        type="submit"
        className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base"
        disabled={isLoading}
      >
        {isLoading ? 'Loading...' : 'Load Graph'}
      </button>
    </form>
  );
};

export default function WelcomePage({ onGraphLoad }) {
  const [animationStep, setAnimationStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const timers = [
      setTimeout(() => setAnimationStep(1), 50),    // Base black BG visible, start overlay fade
      setTimeout(() => setAnimationStep(2), 500),   // Title
      setTimeout(() => setAnimationStep(3), 1000),  // Subtitle
      setTimeout(() => setAnimationStep(4), 1500),  // Form
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const handleUrlSubmit = async (url) => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      await onGraphLoad(url);
      // If successful, parent component will unmount this WelcomePage.
      // No need to setIsLoading(false) here if unmounting.
    } catch (error) {
      console.error("Error during graph load:", error);
      setErrorMessage(error.message || "Failed to load graph. Please try another URL.");
      setIsLoading(false);
    }
  };

  return (
    <div 
      className={`fixed inset-0 bg-black transition-opacity duration-300 ease-in-out ${animationStep >= 0 ? 'opacity-100' : 'opacity-0'}`}
    >
      {/* Blurry Off-White Overlay */}
      <div 
        className={`absolute inset-0 bg-[#F5F5F5] transition-opacity duration-1000 ease-in-out ${animationStep >= 1 ? 'opacity-90' : 'opacity-0'}`}
        // For a more pronounced blur effect, uncomment and adjust:
        // style={{ backdropFilter: animationStep >= 1 ? 'blur(4px)' : 'blur(0px)' }}
      ></div>

      <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-4">
        {/* Title */}
        <h1 
          className={`text-7xl sm:text-8xl font-bold text-black mb-3 transition-all duration-700 ease-out ${animationStep >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
        >
          Glaze
        </h1>
        
        {/* Subtitle */}
        <p 
          className={`text-xl sm:text-2xl text-gray-700 mb-10 transition-all duration-700 ease-out ${animationStep >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
          style={{ transitionDelay: animationStep >= 3 ? '0ms' : '250ms' }} 
        >
          spacial discovery space
        </p>

        {/* URL Form */}
        <div 
          className={`w-full max-w-sm transition-all duration-700 ease-out ${animationStep >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
          style={{ transitionDelay: animationStep >= 4 ? '0ms' : '500ms' }} 
        >
          <UrlFormInput onSubmit={handleUrlSubmit} isLoading={isLoading} />
          {errorMessage && (
            <p className="mt-4 text-sm text-red-500 bg-red-100 dark:bg-red-900 dark:text-red-300 px-3 py-2 rounded-md">
              {errorMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  );
} 