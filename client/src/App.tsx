import { Switch, Route, Router } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import MelodyGenerator from "@/pages/melody-generator";
import NotFound from "@/pages/not-found";

// Custom hook for GitHub Pages base path
function useHashLocation() {
  const [loc, setLoc] = React.useState(window.location.hash.replace("#", "") || "/");

  React.useEffect(() => {
    const handler = () => setLoc(window.location.hash.replace("#", "") || "/");
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  const navigate = React.useCallback((to: string) => {
    window.location.hash = to;
  }, []);

  return [loc, navigate] as const;
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={MelodyGenerator} />
      <Route path="/Replit-Melody-Generator" component={MelodyGenerator} />
      <Route path="/Replit-Melody-Generator/" component={MelodyGenerator} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router base="/Replit-Melody-Generator">
          <AppRouter />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;