"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getUser } from "@/lib/auth";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const user = getUser();
    if (user) router.replace("/lobby");
    else router.replace("/login");
  }, []);

  return (
    <main style={{ minHeight:"100vh", background:"#FDF0EE", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:"48px", marginBottom:"8px" }}>✊🖐️✌️</div>
        <div style={{ color:"#8B2635", fontSize:"18px", fontWeight:"800" }}>JANKEN</div>
      </div>
    </main>
  );
}
