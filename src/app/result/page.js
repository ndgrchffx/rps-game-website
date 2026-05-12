"use client";
import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Result page tidak lagi dipakai - game over ditampilkan langsung di game/page.js
// Halaman ini hanya redirect ke lobby
function ResultContent() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    // Redirect ke lobby setelah 100ms (fallback jika ada yang navigasi ke sini)
    const t = setTimeout(() => router.replace("/lobby"), 100);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <main style={{ minHeight: "100vh", background: "#FDF0EE", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#888", fontSize: "14px" }}>Mengalihkan...</p>
    </main>
  );
}

export default function ResultPage() {
  return <Suspense><ResultContent /></Suspense>;
}
