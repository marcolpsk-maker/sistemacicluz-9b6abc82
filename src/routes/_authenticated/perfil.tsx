import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Construction } from "lucide-react";

export const Route = createFileRoute("/_authenticated/perfil")({ component: P });
function P() { return <div className="space-y-4"><h1>Perfil</h1><Card className="p-8 text-center"><Construction className="h-10 w-10 text-accent mx-auto mb-3" /><p className="text-muted-foreground">Em breve.</p></Card></div>; }
