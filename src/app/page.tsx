import ScrambleText from "@/components/ScrambleText";
import GradientCursor from "@/components/GradientCursor";

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-6">
      <GradientCursor />
      <div className="relative z-10 text-center">
        <h1 className="text-4xl font-medium tracking-tight sm:text-5xl md:text-6xl">
          <ScrambleText text="Weldon Yang" />
        </h1>
      </div>
    </main>
  );
}
