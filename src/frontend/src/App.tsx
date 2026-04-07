import { Toaster } from "@/components/ui/sonner";
import FileExplorer from "./components/FileExplorer";
import LoginPage from "./components/LoginPage";
import { useInternetIdentity } from "./hooks/useInternetIdentity";

export default function App() {
  const { identity, isInitializing } = useInternetIdentity();

  if (isInitializing) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Toaster richColors position="top-right" />
      {identity ? <FileExplorer /> : <LoginPage />}
    </>
  );
}
