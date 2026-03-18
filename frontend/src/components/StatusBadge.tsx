"use client";

import React from "react";

interface StatusBadgeProps {
  connected: boolean;
  cameraActive: boolean;
  isDetecting: boolean;
}

export default function StatusBadge({
  connected,
  cameraActive,
  isDetecting,
}: StatusBadgeProps) {
  const items = [
    {
      label: "Server",
      active: connected,
      activeColor: "bg-green-500",
      inactiveColor: "bg-red-500",
    },
    {
      label: "Camera",
      active: cameraActive,
      activeColor: "bg-green-500",
      inactiveColor: "bg-yellow-500",
    },
    {
      label: "Detecting",
      active: isDetecting,
      activeColor: "bg-blue-500",
      inactiveColor: "bg-gray-500",
    },
  ];

  return (
    <div className="flex items-center gap-4">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <div
            className={`w-2 h-2 rounded-full ${
              item.active ? item.activeColor : item.inactiveColor
            } ${item.active ? "animate-pulse-slow" : ""}`}
          />
          <span className="text-xs text-gray-400">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
