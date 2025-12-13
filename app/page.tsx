"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import NumberTicker from "@/components/magic-ui/number-ticker";
import { Button } from "@/components/ui/button";
import { DotPattern } from "@/components/magic-ui/dot-pattern";

export default function Home() {
  const [focusLabel] = useState<"DSA" | "System Design">(() =>
    Math.random() < 0.5 ? "DSA" : "System Design"
  );

  return (
    <div>
      <main>
        <div className="z-0 relative w-full bg-gradient-to-b from-background to-primary/10 pb-6 md:pb-40 md:min-h-screen overflow-hidden">
          <DotPattern className="absolute inset-0 z-0 [mask-image:radial-gradient(50vw_circle_at_center,white,transparent)]" />
          <div className="relative z-10 flex flex-col items-center justify-start min-h-screen space-y-4 px-4 pt-12">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold uppercase tracking-tight">
                Proudly Open Source
              </span>
              <span aria-hidden className="h-6 w-[2px] bg-foreground" />
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold leading-none text-foreground whitespace-nowrap">
                  Backed by
                </span>
                <Image
                  src="/cloudflare.png"
                  alt="Cloudflare"
                  width={168}
                  height={44}
                  className="h-9 w-auto translate-y-[1px]"
                />
              </div>
            </div>
            <h1 className="text-center text-5xl md:text-7xl font-bold break-words w-full max-w-[92vw] md:max-w-[1200px] px-2 mx-auto -z-10 leading-tight">
              <span className="md:whitespace-nowrap">Padhle {focusLabel} kahin se, </span>
              <br className="hidden md:block" />
              <span>selection hogi yahi se.</span>
            </h1>
            <h2 className="text-xl text-opacity-60 tracking-normal text-center max-w-2xl mx-auto z-10">
              Suffer from <NumberTicker value={8000} />+ company-wise DSA questions like a true
              Codejeet. Kyunki naukri ke liye sab kuch chalega!
            </h2>
            <div className="z-20 flex gap-3">
              <Link href="/dashboard">
                <Button size="lg" className="shadow-2xl h-12 px-8 text-lg leading-none">
                  Get Started
                </Button>
              </Link>
              <Link href="/system-design">
                <Button
                  size="lg"
                  variant="outline"
                  className="shadow-2xl h-12 px-8 text-lg leading-none"
                >
                  System Design
                </Button>
              </Link>
            </div>
            <div className="-mt-16 w-full">
              <Image
                src={focusLabel === "DSA" ? "/image1.png" : "/image2.png"}
                alt="Image"
                width={2000}
                height={1500}
                className="w-full h-auto max-w-[92vw] md:max-w-[1200px] mx-auto rounded-2xl shadow-lg px-0 sm:px-4"
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
