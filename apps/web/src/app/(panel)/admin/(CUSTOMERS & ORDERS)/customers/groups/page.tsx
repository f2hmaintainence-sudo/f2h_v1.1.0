import React from 'react';
import { Map } from 'lucide-react';

export default function CustomerGroupsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f9f6ef] to-[#e8f5ec] flex flex-col items-center justify-center p-6 text-center font-sans">
      <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg mb-8 ring-4 ring-fresh-green/20">
        <Map size={48} className="text-fresh-green" />
      </div>
      <h1 className="text-3xl md:text-4xl font-extrabold text-deep-green mb-4">
        Groups & Zones
      </h1>
      <p className="text-gray-500 max-w-md mx-auto leading-relaxed">
        This module is currently under development. Soon you'll be able to organize customers geographically for efficient delivery routing.
      </p>
      <div className="mt-8 px-6 py-2 bg-white rounded-full text-sm font-bold text-deep-green shadow-sm border border-gray-100">
        Work in Progress
      </div>
    </div>
  );
}
