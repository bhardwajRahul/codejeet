import Link from "next/link";

const Navbar = () => {
  return (
    <div className="border-b sticky top-0 z-50 bg-background">
      <div className="flex h-16 items-center px-4 container mx-auto">
        <div className="font-bold text-2xl flex-1">
          <Link href="/" className="flex items-center">
            <span className="inline drop-shadow-lg font-poppins">CodeJeet</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Navbar;
