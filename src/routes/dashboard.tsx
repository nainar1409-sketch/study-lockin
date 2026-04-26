import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AppNav } from "@/components/AppNav";
import { useRequireAuth } from "@/lib/use-require-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, BookOpen, PlusCircle, Trash2, Flame } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard — LockIn" }] }),
});

interface Plan {
  id: string;
  title: string;
  days: number;
  hours_per_day: number | null;
  subjects: { name: string }[];
  created_at: string;
}

function Dashboard() {
  const { user, loading } = useRequireAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [streak, setStreak] = useState(0);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("study_plans")
        .select("id,title,days,hours_per_day,subjects,created_at")
        .order("created_at", { ascending: false });
      if (error) toast.error(error.message);
      else setPlans((data ?? []) as Plan[]);

      // streak: count distinct days (UTC) in last 30 days where user completed any task, ending today
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data: prog } = await supabase
        .from("plan_progress")
        .select("completed_at")
        .eq("completed", true)
        .gte("completed_at", since);
      const days = new Set((prog ?? []).map((p) => (p.completed_at ?? "").slice(0, 10)));
      let s = 0;
      const d = new Date();
      while (true) {
        const k = d.toISOString().slice(0, 10);
        if (days.has(k)) { s++; d.setDate(d.getDate() - 1); } else break;
      }
      setStreak(s);
      setBusy(false);
    })();
  }, [user]);

  async function deletePlan(id: string) {
    if (!confirm("Delete this plan?")) return;
    const { error } = await supabase.from("study_plans").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { setPlans(plans.filter((p) => p.id !== id)); toast.success("Deleted"); }
  }

  if (loading || !user) return null;

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-sm text-muted-foreground uppercase tracking-widest">Welcome back</p>
            <h1 className="text-3xl md:text-4xl font-bold mt-1">Your study command center</h1>
          </div>
          <div className="glass rounded-2xl px-5 py-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500/40 to-primary/40 flex items-center justify-center">
              <Flame className="h-5 w-5 text-orange-300" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Streak</p>
              <p className="text-xl font-bold">{streak} {streak === 1 ? "day" : "days"}</p>
            </div>
          </div>
        </motion.div>

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Your plans</h2>
          <Link to="/planner"><Button className="bg-gradient-to-r from-primary to-accent text-primary-foreground btn-glow"><PlusCircle className="h-4 w-4 mr-2"/>New plan</Button></Link>
        </div>

        {busy ? (
          <div className="grid md:grid-cols-2 gap-4">
            {[0,1].map(i => <div key={i} className="glass rounded-2xl h-40 animate-pulse"/>)}
          </div>
        ) : plans.length === 0 ? (
          <div className="glass rounded-3xl p-10 text-center">
            <p className="text-muted-foreground mb-4">No plans yet. Time to lock in.</p>
            <Link to="/planner"><Button className="bg-gradient-to-r from-primary to-accent text-primary-foreground btn-glow">Create your first plan</Button></Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {plans.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass rounded-2xl p-5 hover:bg-white/[0.08] transition-colors">
                <div className="flex justify-between items-start gap-3">
                  <Link to="/result/$id" params={{ id: p.id }} className="flex-1">
                    <h3 className="font-semibold text-lg">{p.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(p.created_at).toLocaleDateString()}</p>
                  </Link>
                  <Button size="icon" variant="ghost" onClick={() => deletePlan(p.id)}><Trash2 className="h-4 w-4 text-muted-foreground"/></Button>
                </div>
                <div className="flex flex-wrap gap-3 mt-4 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Calendar className="h-4 w-4"/>{p.days} days</span>
                  {p.hours_per_day && <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4"/>{p.hours_per_day}h/day</span>}
                  <span className="inline-flex items-center gap-1"><BookOpen className="h-4 w-4"/>{p.subjects.length} subjects</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {p.subjects.slice(0,4).map((s, j) => (
                    <span key={j} className="text-xs px-2 py-1 rounded-md bg-white/5 border border-glass-border">{s.name}</span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
