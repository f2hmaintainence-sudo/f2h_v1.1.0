"use client";

export default function DeliveryMapPage() {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <h1 className="text-lg font-bold text-deep-green">Route Map</h1>
        <p className="text-sm text-gray-500 mt-1">Your optimized route for this morning.</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 min-h-[360px] flex items-center justify-center text-center">
        <div>
          <p className="text-5xl mb-3">🗺️</p>
          <p className="font-semibold text-gray-800">Live map view placeholder</p>
          <p className="text-sm text-gray-500 mt-1">Google Maps integration can be connected here.</p>
        </div>
      </div>
    </div>
  );
}
