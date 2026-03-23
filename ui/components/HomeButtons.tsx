"use client";

import Button from './Button';

export default function HomeButtons() {
  const handleViewSample = () => {
    window.location.href = '/sample';
  };

  const handleLearnMore = () => {
    alert('Button component is working! Check out /sample for more examples.');
  };

  return (
    <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
      <Button onClick={handleViewSample} variant="primary">
        View Sample
      </Button>
      <Button onClick={handleLearnMore} variant="outline">
        Learn More
      </Button>
    </div>
  );
}
