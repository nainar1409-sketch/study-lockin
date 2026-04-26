import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AppNav } from "@/components/AppNav";
import { useRequireAuth } from "@/lib/use-require-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Clock, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/result/$id")({
  component: ResultPage,
  head: () => ({ meta: [{ title: "Your timetable — LockIn" }] }),
});

interface Task {
  subject: string;
  topics: string[];
  duration_hours: number;
  type: "study" | "revision" | "practice" | "buffer";
}
interface Day { day: number; label: string; tasks: Task[]; }
interface Timetable { summary: string; days: Day[]; }
interface ProgressRow { day_index: number; task_index: number; completed: boolean; }

const COLORS = [
  "from-emerald-500/30 to-teal-500/30 border-emerald-400/30",
  "from-violet-500/30 to-fuchsia-500/30 border-violet-400/30",
  "from-sky-500/30 to-cyan-500/30 border-sky-400/30",
  "from-amber-500/30 to-orange-500/30 border-amber-400/30",
  "from-rose-500/30 to-pink-500/30 border-rose-400/30",
  "from-lime-500/30 to-green-500/30 border-lime-400/30",
];

function ResultPage() {
  const { id } = useParams({ from: "/result/$id" });
  const { user, loading } = useRequireAuth();
  const [plan, setPlan] = useState<{ title: string; timetable: Timetable } | null>(null);
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(true);
  const [exporting, setExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("study_plans")
        .select("title,timetable")
        .eq("id", id)
        .single();
      if (error) { toast.error(error.message); setBusy(false); return; }
      setPlan(data as unknown as { title: string; timetable: Timetable });

      const { data: prog } = await supabase
        .from("plan_progress")
        .select("day_index,task_index,completed")
        .eq("plan_id", id);
      const map: Record<string, boolean> = {};
      (prog ?? []).forEach((p: ProgressRow) => { map[`${p.day_index}-${p.task_index}`] = p.completed; });
      setProgress(map);
      setBusy(false);
    })();
  }, [id, user]);

  const subjectColor = useMemo(() => {
    const map: Record<string, string> = {};
    if (!plan) return map;
    const subjects = Array.from(new Set(plan.timetable.days.flatMap((d) => d.tasks.map((t) => t.subject))));
    subjects.forEach((s, i) => { map[s] = COLORS[i % COLORS.length]; });
    return map;
  }, [plan]);

  async function toggle(dayIdx: number, taskIdx: number) {
    const key = `${dayIdx}-${taskIdx}`;
    const next = !progress[key];
    setProgress({ ...progress, [key]: next });
    const { error } = await supabase
      .from("plan_progress")
      .upsert(
        {
          plan_id: id, user_id: user!.id,
          day_index: dayIdx, task_index: taskIdx,
          completed: next,
          completed_at: next ? new Date().toISOString() : null,
        },
        { onConflict: "plan_id,day_index,task_index" }
      );
    if (error) { toast.error(error.message); setProgress({ ...progress, [key]: !next }); }
  }

  async function exportPdf() {
    if (!printRef.current || !plan) return;
    setExporting(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const opts = {
        margin: [10, 10, 10, 10],
        filename: `${plan.title.replace(/[^a-z0-9]+/gi, "_")}_LockIn.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, backgroundColor: "#1a1a2e" },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      };
      await html2pdf().from(printRef.current).set(opts as never).save();
    } catch (e) {
      console.error(e);
      toast.error("PDF export failed");
    } finally {
      setExporting(false);
    }
  }

  if (loading || !user) return null;

  const totalTasks = plan?.timetable.days.reduce((a, d) => a + d.tasks.length, 0) ?? 0;
  const doneTasks = Object.values(progress).filter(Boolean).length;
  const pct = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="h-4 w-4"/>Back to dashboard</Link>

        {busy ? (
          <div className="glass rounded-3xl h-96 animate-pulse"/>
        ) : !plan ? (
          <p className="text-muted-foreground">Plan not found.</p>
        ) : (
          <>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-4 mb-6">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold">{plan.title}</h1>
                <p className="text-muted-foreground mt-2 max-w-2xl">{plan.timetable.summary}</p>
              </div>
              <Button onClick={exportPdf} disabled={exporting} className="bg-gradient-to-r from-primary to-accent text-primary-foreground btn-glow">
                {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <Download className="h-4 w-4 mr-2"/>}Download PDF
              </Button>
            </motion.div>

            <div className="glass rounded-2xl p-4 mb-6 flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{doneTasks}/{totalTasks} tasks · {pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} className="h-full bg-gradient-to-r from-primary to-accent" />
                </div>
              </div>
            </div>

            <div ref={printRef} className="space-y-4">
              <div className="hidden print:block mb-4">
                <h2 className="text-2xl font-bold">{plan.title}</h2>
                <p className="text-sm">{plan.timetable.summary}</p>
              </div>
              {plan.timetable.days.map((d, di) => (
                <motion.div
                  key={di}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: di * 0.03 }}
                  className="glass rounded-2xl p-5"
                >
                  <div className="flex items-baseline justify-between mb-3">
                    <h3 className="font-display font-bold text-lg">
                      <span className="gradient-text">Day {d.day}</span>
                      <span className="text-muted-foreground font-normal text-sm ml-2">{d.label !== `Day ${d.day}` ? d.label : ""}</span>
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {d.tasks.reduce((a, t) => a + t.duration_hours, 0).toFixed(1)}h total
                    </span>
                  </div>
                  <div className="space-y-2">
                    {d.tasks.map((t, ti) => {
                      const key = `${di}-${ti}`;
                      const done = !!progress[key];
                      return (
                        <div key={ti} className={`rounded-xl border bg-gradient-to-r ${subjectColor[t.subject] ?? COLORS[0]} p-3 md:p-4 transition-opacity ${done ? "opacity-50" : ""}`}>
                          <div className="flex items-start gap-3">
                            <Checkbox checked={done} onCheckedChange={() => toggle(di, ti)} className="mt-1 print:hidden" />
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">{t.subject}</span>
                                  <span className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-black/20 border border-white/10">{t.type}</span>
                                </div>
                                <span className="inline-flex items-center gap-1 text-xs text-foreground/80"><Clock className="h-3 w-3"/>{t.duration_hours}h</span>
                              </div>
                              <ul className={`mt-1.5 text-sm text-foreground/90 list-disc pl-5 space-y-0.5 ${done ? "line-through" : ""}`}>
                                {t.topics.map((tp, k) => <li key={k}>{tp}</li>)}
                              </ul>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
