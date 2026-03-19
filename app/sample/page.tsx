"use client";

import { useState } from 'react';
import Button from '@/ui/components/Button';
import Link from 'next/link';

export default function SamplePage() {
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState('');

  const handleIncrement = () => {
    setCount(count + 1);
    setMessage(`Button clicked ${count + 1} time(s)!`);
  };

  const handleReset = () => {
    setCount(0);
    setMessage('Counter reset!');
  };

  return (
    <div className="min-h-screen bg-zinc-50 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-4 text-zinc-900">
          Sample React Component Page
        </h1>
        
        <p className="text-zinc-600 mb-8">
          This is a proof of concept showing React state management and reusable components.
        </p>

        <div className="bg-zinc-100 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-zinc-900">
            Counter Demo
          </h2>
          
          <div className="text-5xl font-bold text-center mb-6 text-blue-600">
            {count}
          </div>

          {message && (
            <div className="text-center mb-4 text-green-600 font-medium">
              {message}
            </div>
          )}

          <div className="flex gap-4 justify-center flex-wrap">
            <Button onClick={handleIncrement} variant="primary">
              Increment
            </Button>
            <Button onClick={handleReset} variant="secondary">
              Reset
            </Button>
            <Button onClick={() => setMessage('Outline button clicked!')} variant="outline">
              Outline Style
            </Button>
          </div>
        </div>

        <div className="mt-6">
          <Link 
            href="/"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
