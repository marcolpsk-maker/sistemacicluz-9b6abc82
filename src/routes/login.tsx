import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/login")({ component: LoginPage });

const signInSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "Mínimo de 6 caracteres").max(100),
});
const signUpSchema = signInSchema.extend({
  name: z.string().trim().min(1, "Nome obrigatório").max(100),
});

type SignInValues = z.infer<typeof signInSchema>;
type SignUpValues = z.infer<typeof signUpSchema>;

function LoginPage() {
  const { user, signIn, signUp, loading } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [loading, user, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-light via-background to-secondary-light px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Link to="/" className="text-4xl font-bold text-primary tracking-tight">CICLUZ</Link>
          <p className="mt-2 text-sm text-muted-foreground">Plataforma de gestão integrada</p>
        </div>

        <Card className="p-6 md:p-8">
          <h1 className="text-2xl font-bold text-foreground mb-1">
            {mode === "signin" ? "Entrar" : "Criar conta"}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === "signin" ? "Acesse sua conta CICLUZ" : "Cadastre-se para começar"}
          </p>

          {mode === "signin" ? (
            <SignInForm onSubmit={signIn} submitting={submitting} setSubmitting={setSubmitting} onDone={() => navigate({ to: "/dashboard" })} />
          ) : (
            <SignUpForm onSubmit={signUp} submitting={submitting} setSubmitting={setSubmitting} onDone={() => navigate({ to: "/dashboard" })} />
          )}

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>Ainda não tem conta? <button className="text-primary font-medium hover:underline" onClick={() => setMode("signup")}>Cadastre-se</button></>
            ) : (
              <>Já tem conta? <button className="text-primary font-medium hover:underline" onClick={() => setMode("signin")}>Entrar</button></>
            )}
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

function SignInForm({ onSubmit, submitting, setSubmitting, onDone }: {
  onSubmit: (email: string, password: string) => Promise<void>;
  submitting: boolean; setSubmitting: (v: boolean) => void; onDone: () => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<SignInValues>({ resolver: zodResolver(signInSchema) });

  const submit = async (v: SignInValues) => {
    setSubmitting(true);
    try {
      await onSubmit(v.email, v.password);
      toast.success("Bem-vindo!");
      onDone();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao entrar";
      toast.error(msg.includes("Invalid login") ? "E-mail ou senha incorretos" : msg);
    } finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" type="email" {...register("email")} placeholder="seu@email.com" />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Senha</Label>
        <Input id="password" type="password" {...register("password")} placeholder="••••••••" />
        {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
      </div>
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
      </Button>
    </form>
  );
}

function SignUpForm({ onSubmit, submitting, setSubmitting, onDone }: {
  onSubmit: (email: string, password: string, name: string) => Promise<void>;
  submitting: boolean; setSubmitting: (v: boolean) => void; onDone: () => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<SignUpValues>({ resolver: zodResolver(signUpSchema) });

  const submit = async (v: SignUpValues) => {
    setSubmitting(true);
    try {
      await onSubmit(v.email, v.password, v.name);
      toast.success("Conta criada! Bem-vindo ao CICLUZ.");
      onDone();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao criar conta";
      toast.error(msg.includes("already registered") ? "E-mail já cadastrado" : msg);
    } finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Nome</Label>
        <Input id="name" {...register("name")} placeholder="Seu nome" />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" type="email" {...register("email")} placeholder="seu@email.com" />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Senha</Label>
        <Input id="password" type="password" {...register("password")} placeholder="Mínimo 6 caracteres" />
        {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
      </div>
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar conta"}
      </Button>
    </form>
  );
}
