import { PlayerPage } from "@/components/PlayerPage";

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main>
      <h1>Watch video</h1>
      <PlayerPage videoId={id} />
    </main>
  );
}
