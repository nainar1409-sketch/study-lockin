import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { Swords, Brain, Calendar, FileDown, Flame } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "LockIn — Lock in. Plan smart. Execute." },
      { name: "description", content: "AI-powered exam preparation timetables. Upload your syllabus, set your days, and get a disciplined, day-by-day study plan." },
    ],
  }),
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen">
      <nav className="flex items-center justify-between px-6 md:px-12 py-6">
        <div className="flex items-center gap-2 font-display font-bold text-xl">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent btn-glow">
            <Swords className="h-5 w-5 text-primary-foreground" />
          </span>
          LockIn
        </div>
        <div className="flex gap-2">
          <Link to="/login"><Button variant="ghost">Sign in</Button></Link>
          <Link to="/login" search={{ mode: "signup" } as never}><Button className="bg-gradient-to-r from-primary to-accent text-primary-foreground btn-glow">Get started</Button></Link>
        </div>
      </nav>

      <section className="px-6 md:px-12 pt-12 md:pt-24 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-xs uppercase tracking-widest text-muted-foreground mb-6">
            <Flame className="h-3.5 w-3.5 text-primary" />
            Built for serious students
          </div>
          <h1 className="text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight">
            Lock in. <span className="gradient-text">Plan smart.</span><br />Execute with discipline.
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Drop your syllabus, tell us how many days you have, and get an AI-built day-by-day study timetable with rotation, revision, and buffer days.
          </p>
          <div className="mt-10 flex flex-wrap gap-3 justify-center">
            <Link to="/login" search={{ mode: "signup" } as never}>
              <Button size="lg" className="bg-gradient-to-r from-primary to-accent text-primary-foreground btn-glow text-base px-8 h-12">
                Start your plan free
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="glass border-glass-border h-12 px-8">I already have an account</Button>
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mt-20 grid md:grid-cols-3 gap-6"
        >
          {[
            { icon: Brain, title: "AI timetable", desc: "Syllabus broken into logical chunks, rotated across days." },
            { icon: Calendar, title: "Revision built-in", desc: "Buffer & revision days scheduled before exams automatically." },
            { icon: FileDown, title: "Export to PDF", desc: "Print-ready, beautifully formatted timetable in one click." },
          ].map((f, i) => (
            <div key={i} className="glass rounded-2xl p-6">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center mb-4">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="text-muted-foreground mt-1 text-sm">{f.desc}</p>
            </div>
          ))}
        </motion.div>
        <div className="h-24" />
      </section>
    </div>
  );
}
