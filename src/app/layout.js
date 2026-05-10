import "./globals.css";
import SWRegister from "./sw-register";
export const metadata = { title: "JANKEN - RPS Battle Arena", description: "Rock Paper Scissors PvP dengan Trivia Twists" };
export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        {children}
        <SWRegister />
      </body>
    </html>
  );
}
