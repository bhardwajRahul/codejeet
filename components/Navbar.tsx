import Link from "next/link";
import { Press_Start_2P } from "next/font/google";

const pixel = Press_Start_2P({ subsets: ["latin"], weight: "400" });

const LOGO_LETTERS = [
  { char: "c", color: "#4285F4" },
  { char: "o", color: "#EA4335" },
  { char: "d", color: "#FBBC05" },
  { char: "e", color: "#34A853" },
  { char: "j", color: "#FF6D00" },
  { char: "e", color: "#00BCD4" },
  { char: "e", color: "#A259FF" },
  { char: "t", color: "#FF4081" },
];

const Navbar = () => {
  return (
    <div className="border-b sticky top-0 z-50 bg-background">
      <div className="flex h-16 items-center px-4 container mx-auto">
        <div className="text-lg flex-1">
          <Link href="/" className="flex items-center">
            <span className={pixel.className}>
              {LOGO_LETTERS.map((l, i) => (
                <span key={i} style={{ color: l.color }}>
                  {l.char}
                </span>
              ))}
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Navbar;
