import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { z } from "zod";
import { AppNav } from "@/components/AppNav";
import { useRequireAuth } from "@/lib/use-require-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Upload, Loader2, Swords } from "lucide-react";
import { toast } from "sonner";
import { extractPdfText } from "@/lib/pdf-extract";

export const Route = createFileRoute("/planner")({
  component: Planner,
  head: () => ({ meta: [{ title: "New plan — LockIn" }] }),
});

interface SubjectInput {
  id: string;
  name: string;
  syllabus: string;
  parsing?: boolean;
}

function Planner() {
  const { user, loading } = useRequireAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [days, setDays] = useState(14);
  const [hours, setHours] = useState<number | "">(4);
  const [subjects, setSubjects] = useState<SubjectInput[]>([
    { id: crypto.randomUUID(), name: "", syllabus: "" },
  ]);
  const [generating, setGenerating] = useState(false);

  function addSubject() {
    setSubjects([...subjects, { id: crypto.randomUUID(), name: "", syllabus: "" }]);
  }
  function removeSubject(id: string) {
    setSubjects(subjects.length > 1 ? subjects.filter((s) => s.id !== id) : subjects);
  }
  function updateSubject(id: string, patch: Partial<SubjectInput>) {
    setSubjects(subjects.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  async function onPdfUpload(id: string, file: File) {
    updateSubject(id, { parsing: true });
    try {
      const text = await extractPdfText(file);
      updateSubject(id, { syllabus: text, parsing: false });
      toast.success(`Extracted ${text.length} chars from PDF`);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't read that PDF. Paste the text instead.");
      updateSubject(id, { parsing: false });
    }
  }

  async function generate() {
    const schema = z.object({
      title: z.string().trim().min(1, "Title required").max(120),
      days: z.number().int().min(1).max(365),
      hours: z.union([z.number().min(0.5).max(16), z.literal("")]),
      subjects: z.array(z.object({
        name: z.string().trim().min(1, "Subject name required").max(80),
        syllabus: z.string().trim().min(10, "Syllabus too short — paste real content"),
      })).min(1),
    });
    const parsed = schema.safeParse({
      title, days: Number(days), hours,
      subjects: subjects.map((s) => ({ name: s.name, syllabus: s.syllabus })),
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-plan", {
        body: {
          subjects: parsed.data.subjects,
          days: parsed.data.days,
          hoursPerDay: parsed.data.hours === "" ? undefined : parsed.data.hours,
        },
      });
      if (error) {
        const msg = (error as { message?: string }).message ?? "Failed to generate";
        toast.error(msg);
        return;
      }
      if (data?.error) { toast.error(data.error); return; }

      const { data: ins, error: insErr } = await supabase
        .from("study_plans")
        .insert({
          user_id: user!.id,
          title: parsed.data.title,
          days: parsed.data.days,
          hours_per_day: parsed.data.hours === "" ? null : parsed.data.hours,
          subjects: parsed.data.subjects.map((s) => ({ name: s.name })),
          timetable: data.plan,
        })
        .select("id")
        .single();
      if (insErr) { toast.error(insErr.message); return; }
      toast.success("Plan ready. Lock in.");
      navigate({ to: "/result/$id", params: { id: ins.id } });
    } finally {
      setGenerating(false);
    }
  }

  if (loading || !user) return null;

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl md:text-4xl font-bold">Build your study plan</h1>
          <p className="text-muted-foreground mt-2">Add subjects, paste or upload syllabi, set the days. AI does the rest.</p>
        </motion.div>

        <div className="glass-strong rounded-3xl p-6 md:p-8 mt-8 space-y-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-3">
              <Label htmlFor="title">Plan title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="JEE Mains Final Sprint" className="glass border-glass-border mt-1" />
            </div>
            <div>
              <Label htmlFor="days">Days available</Label>
              <Input id="days" type="number" min={1} max={365} value={days} onChange={(e) => setDays(Number(e.target.value))} className="glass border-glass-border mt-1" />
            </div>
            <div>
              <Label htmlFor="hours">Hours / day (optional)</Label>
              <Input id="hours" type="number" min={0.5} max={16} step={0.5} value={hours} onChange={(e) => setHours(e.target.value === "" ? "" : Number(e.target.value))} className="glass border-glass-border mt-1" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-lg">Subjects</h2>
              <Button onClick={addSubject} variant="outline" size="sm" className="glass border-glass-border"><Plus className="h-4 w-4 mr-1"/>Add subject</Button>
            </div>

            <AnimatePresence initial={false}>
              {subjects.map((s, idx) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: -10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  className="glass rounded-2xl p-5"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs uppercase tracking-widest text-muted-foreground">Subject {idx + 1}</span>
                    {subjects.length > 1 && (
                      <Button onClick={() => removeSubject(s.id)} variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-muted-foreground"/></Button>
                    )}
                  </div>
                  <Input value={s.name} onChange={(e) => updateSubject(s.id, { name: e.target.value })} placeholder="e.g. Physics" className="glass border-glass-border mb-3" />
                  <Textarea value={s.syllabus} onChange={(e) => updateSubject(s.id, { syllabus: e.target.value })} placeholder="Paste syllabus, chapters, topics..." rows={5} className="glass border-glass-border resize-none" />
                  <div className="mt-3 flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                      <input type="file" accept="application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPdfUpload(s.id, f); e.currentTarget.value = ""; }} />
                      {s.parsing ? <Loader2 className="h-4 w-4 animate-spin"/> : <Upload className="h-4 w-4"/>}
                      {s.parsing ? "Parsing PDF..." : "Upload syllabus PDF"}
                    </label>
                    <span className="text-xs text-muted-foreground ml-auto">{s.syllabus.length} chars</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <Button onClick={generate} disabled={generating} className="w-full h-12 bg-gradient-to-r from-primary to-accent text-primary-foreground btn-glow text-base">
            {generating ? <><Loader2 className="h-5 w-5 mr-2 animate-spin"/>Generating your plan...</> : <><Swords className="h-5 w-5 mr-2"/>Generate plan</>}
          </Button>
        </div>
      </main>
    </div>
  );
}
