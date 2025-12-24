"use client";

import { MockupHorizontal } from "./mockup/mockup-horizontal";

export default function HeroSatu() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-br from-white via-gray-50 to-blue-50 dark:from-gray-100 dark:to-slate-100">
      {/* Container full width */}
      <div
        className="relative w-screen overflow-hidden"
        style={{
          marginLeft: "calc(-50vw + 50%)",
          marginRight: "calc(-50vw + 50%)",
          height: "100vh",
        }}
      >
        {/* Bagian Atas - 25% */}
        <div
          className="absolute top-0 left-0 right-0"
          style={{ height: "25%" }}
        />

        {/* Bagian Tengah - 40% dengan efek depth */}
        <div
          className="absolute left-0 right-0"
          style={{
            top: "25%",
            height: "40%",
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.05) 50%, rgba(0,0,0,0.02) 100%)",
            boxShadow: `
              inset 0 10px 30px -10px rgba(0, 0, 0, 0.15),
              inset 0 -10px 30px -10px rgba(0, 0, 0, 0.15)
            `,
          }}
        >
          <MockupHorizontal
            className=""
            containerClassName="h-full"
            animationDuration={20}
            gap={100}
            mockupCount={12}
            mockupWidth={500}
          />
        </div>

        {/* Bagian Bawah - 35% */}
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{ height: "35%" }}
        />
      </div>
    </section>
  );
}
