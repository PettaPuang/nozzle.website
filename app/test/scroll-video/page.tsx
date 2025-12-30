import { StickyScrollVideo } from "@/components/mockup/sticky-scroll-video";

export default function ScrollVideoTestPage() {
  return (
    <main className="min-h-screen bg-black scroll-smooth">
      {/* Sticky Video Section - Hanya satu section, sticky saat scroll */}
      <StickyScrollVideo
        videoSrc="/mockup/generated_video.mp4"
        scrollHeight="500vh"
        className="bg-black"
      />
    </main>
  );
}
