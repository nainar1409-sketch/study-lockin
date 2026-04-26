import { Link, useNavigate } from "@tanstack/react-router";
import { Swords, LogOut, LayoutDashboard, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

export function AppNav() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <nav className="sticky top-0 z-40 glass border-b border-glass-border">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2 font-display font-bold">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent btn-glow">
            <Swords className="h-4 w-4 text-primary-foreground" />
          </span>
          LockIn
        </Link>
        <div className="flex items-center gap-1 md:gap-2">
          <Link to="/dashboard"><Button variant="ghost" size="sm"><LayoutDashboard className="h-4 w-4 md:mr-2"/><span className="hidden md:inline">Dashboard</span></Button></Link>
          <Link to="/planner"><Button variant="ghost" size="sm"><PlusCircle className="h-4 w-4 md:mr-2"/><span className="hidden md:inline">New plan</span></Button></Link>
          <span className="hidden md:block text-xs text-muted-foreground px-2">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate({ to: "/" }); }}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </nav>
  );
}
