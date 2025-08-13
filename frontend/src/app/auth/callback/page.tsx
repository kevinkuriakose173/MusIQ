"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import axios from "axios";

export default function CallbackPage() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Completing login...");

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      setMessage("No code found in URL");
      return;
    }

    axios
      .get(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/callback?code=${code}`, {
        withCredentials: true, // important for cookies
      })
      .then(() => {
        setMessage("You are logged in! 🎉");
      })
      .catch(() => {
        setMessage("Login failed ❌");
      });
  }, [searchParams]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-2xl">{message}</h1>
    </main>
  );
}
