"use client";

import React from "react";

export default function LoginButton() {
  const handleLogin = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/login`;
  };

  return (
    <button
      onClick={handleLogin}
      className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition"
    >
      Login with Spotify
    </button>
  );
}
