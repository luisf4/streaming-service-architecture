import { PlayerPage } from "@/components/PlayerPage";

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="page__main">
      <a href="/" className="page__back">
        ← Upload another video
      </a>
      <h1 className="page__title">Watch video</h1>
      <PlayerPage videoId={id} />
    </main>
  );
}
