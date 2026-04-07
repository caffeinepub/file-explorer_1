import { Button } from "@/components/ui/button";
import { FolderOpen, Lock, Shield, Zap } from "lucide-react";
import { motion } from "motion/react";
import { useInternetIdentity } from "../hooks/useInternetIdentity";

export default function LoginPage() {
  const { login, isLoggingIn } = useInternetIdentity();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center px-8 py-5 border-b border-border bg-card">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <FolderOpen className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-bold text-foreground tracking-tight">
            File Explorer
          </span>
        </div>
      </header>

      {/* Hero */}
      <main className="flex flex-1 items-center justify-center px-6 py-20">
        <div className="max-w-4xl w-full grid md:grid-cols-2 gap-16 items-center">
          {/* Left column */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col gap-6"
          >
            <div className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 w-fit">
              <Shield className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-primary">
                Decentralized &amp; Secure
              </span>
            </div>

            <h1 className="font-display text-5xl font-extrabold text-foreground leading-tight tracking-tight">
              Your files,
              <br />
              <span className="text-primary">anywhere.</span>
            </h1>

            <p className="text-muted-foreground text-lg leading-relaxed">
              Upload, view, and edit any file — from plain text and code to ZIP
              archives and images — all stored securely on the Internet
              Computer.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <Button
                size="lg"
                onClick={login}
                disabled={isLoggingIn}
                className="gap-2 font-semibold"
                data-ocid="login.primary_button"
              >
                {isLoggingIn ? (
                  <div className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                {isLoggingIn ? "Connecting..." : "Sign In to Continue"}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Authenticated via Internet Identity · No passwords required
            </p>
          </motion.div>

          {/* Right column — visual */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="hidden md:block"
          >
            <div className="rounded-2xl border border-border bg-card shadow-elevated p-6 flex flex-col gap-3">
              {/* Mock file browser */}
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <div className="h-3 w-3 rounded-full bg-destructive/70" />
                <div className="h-3 w-3 rounded-full bg-yellow-400/80" />
                <div className="h-3 w-3 rounded-full bg-green-500/70" />
                <span className="ml-2 text-xs text-muted-foreground font-mono">
                  ~/Documents
                </span>
              </div>
              {[
                { icon: "📁", name: "Projects", type: "folder", size: "—" },
                {
                  icon: "📄",
                  name: "README.md",
                  type: "markdown",
                  size: "4.2 KB",
                },
                { icon: "🗜️", name: "archive.zip", type: "zip", size: "1.8 MB" },
                {
                  icon: "🖼️",
                  name: "screenshot.png",
                  type: "image",
                  size: "256 KB",
                },
                {
                  icon: "⚙️",
                  name: "config.json",
                  type: "json",
                  size: "1.1 KB",
                },
                { icon: "📝", name: "notes.txt", type: "text", size: "820 B" },
              ].map((file, i) => (
                <motion.div
                  key={file.name}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.06 }}
                  className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-accent/60 transition-colors cursor-default"
                >
                  <span className="text-base w-5">{file.icon}</span>
                  <span className="flex-1 text-sm font-medium text-foreground truncate">
                    {file.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {file.size}
                  </span>
                </motion.div>
              ))}

              <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Zap className="h-3 w-3 text-primary" />
                <span>6 items · Stored on-chain</span>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-muted-foreground border-t border-border">
        © {new Date().getFullYear()}. Built with ♥ using{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground transition-colors"
        >
          caffeine.ai
        </a>
      </footer>
    </div>
  );
}
