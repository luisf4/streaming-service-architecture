import { UploadForm } from "@/components/UploadForm";

export default function HomePage() {
  return (
    <main className="page__main">
      <h1 className="page__title">Upload a video</h1>
      <UploadForm />
    </main>
  );
}
