# CICLUZ — Plano de Implementação

Plataforma interna de gestão para equipe de marketing: autenticação, sidebar editável, kanban com drag & drop, calendário, lembretes, reuniões, chat com IA (Gemini) e brainstorm (mapa mental + kanban + lista).

## Adaptações ao stack do Lovable

O projeto já roda em **TanStack Start + Lovable Cloud (Supabase)**. Vou seguir 100% da intenção do briefing, com estes ajustes técnicos obrigatórios da plataforma:

- **Backend**: Lovable Cloud (Supabase já provisionado) em vez de configurar Supabase manualmente. O cliente fica em `@/integrations/supabase/client` (já existe no template). Não vou criar `src/lib/supabase.ts`.
- **Componentes UI**: usar **shadcn/ui já instalado** em `src/components/ui/*` (Button, Card, Dialog, Input, etc.) em vez de `@gradui/ui` (não existe no NPM). A intenção — biblioteca shadcn-based — é preservada.
- **Toasts**: `sonner` (já no template).
- **Design tokens**: CSS variables vão para `src/styles.css` em formato `oklch()` (regra do template Tailwind v4) mantendo exatamente as cores do briefing (#4F46E5 índigo, #10B981 esmeralda, #F59E0B âmbar, etc.) — só convertidas de hex para oklch. Light-mode only.
- **Chat IA**: a chave Google é secret server-side. Vou criar um `createServerFn` (`src/lib/gemini.functions.ts`) que chama Gemini, em vez de expor `VITE_GOOGLE_AI_KEY` no browser. Pedirei `GOOGLE_AI_KEY` via secrets tool.
- **Rotas**: file-based em `src/routes/` (TanStack). Rotas autenticadas ficam sob `src/routes/_authenticated/` com guard `beforeLoad` redirecionando para `/login`.
- **Drag & drop**: `@dnd-kit/core` + `@dnd-kit/sortable`.
- **Mapa mental**: `reactflow`.
- **Realtime**: `supabase.channel().on('postgres_changes')` direto do client.

## Schema do banco

Aplico via migration **exatamente** o SQL do briefing (tabelas `profiles`, `areas`, `kanban_categories`, `kanban_cards`, `lembretes`, `reunioes`, `eventos`, `chat_messages`, `brainstorm_nodes`, `brainstorm_connections`), com **uma correção de segurança obrigatória** do Lovable:

- A função `handle_new_user()` precisa de `SET search_path = public` (já está no SQL — ok).
- Policies RLS: vou ajustar para ter policies separadas por operação (SELECT/INSERT/UPDATE/DELETE) com `auth.uid() = user_id` em USING e WITH CHECK, em vez de uma única `FOR ALL`, para passar o scanner de segurança.
- Bucket de storage `avatars` (público) com policies para o próprio usuário fazer upload.
- Trigger `on_auth_user_created` cria profile + 8 áreas padrão.

## Fases de entrega

Vou implementar em **3 PRs grandes** para manter as builds estáveis (não tudo de uma vez):

### Fase 1 — Fundação + UI core
- Habilitar Lovable Cloud, aplicar migration completa, criar bucket `avatars`.
- Pedir secret `GOOGLE_AI_KEY`.
- Design tokens em `src/styles.css` (oklch convertido do hex do briefing) + Inter font.
- Rotas: `/login`, `_authenticated.tsx` (guard), `_authenticated/index.tsx` (redirect → dashboard).
- `useAuth` hook + página de login (email/senha + signup).
- Layout raiz com **Sidebar editável** (CRUD de áreas, drag-to-reorder com @dnd-kit, seletor de ícones Lucide, modal `AreaDialog`).
- Modais base: `ConfirmDialog`, `InputDialog`, `AreaDialog` (Framer Motion, sem alert/confirm nativo).
- Dashboard com 4 stats cards + 2 gráficos Recharts (tarefas por status, atividade 7 dias) + listas (próximas reuniões, tarefas hoje).

### Fase 2 — Módulos principais
- **Kanban** (`/kanban`): colunas + cards com @dnd-kit, realtime, badge de prioridade, modal de edição.
- **Calendário** (`/calendario`): implementação manual (mês/semana/dia), eventos + reuniões agregados.
- **Lembretes** (`/lembretes`): lista filtrável, checkbox com animação de risco, realtime.
- **Reuniões** (`/reunioes`): agrupado por Hoje/Semana/Futuras/Passadas, ao salvar também cria registro em `eventos`.

### Fase 3 — IA, brainstorm e perfil
- **Chat IA** (`/chat`): server function `sendChatMessage` chamando Gemini 1.5 Flash, histórico em `chat_messages`, bolhas user/assistant com markdown.
- **Brainstorm** (`/brainstorm`): toggle 3 views — Mapa (reactflow com nós/conexões + persistência), Kanban (reaproveitando KanbanBoard filtrado por status do nó), Lista (árvore hierárquica).
- **Perfil** (`/perfil`): formulário react-hook-form + zod, upload de avatar para bucket `avatars`, alterar senha.
- **Admin** (`/admin`): tabs Configurações / Logs / Backup (export JSON).
- Polimento: animações Framer Motion (page transition, modal, stagger sidebar), responsividade 375/768/1440, ARIA.

## Detalhes técnicos relevantes

- **Estrutura de pastas**: sigo o briefing (`src/components/{ui,modals,layout,dashboard,kanban,...}`, `src/hooks`, `src/lib`, `src/types`, `src/schemas`).
- **Tipos**: `Database` gerado pelo Lovable Cloud + tipos de domínio em `src/types/index.ts`.
- **Validação**: todos os forms com `react-hook-form` + `zodResolver`.
- **Erros**: `toast.error` do sonner, nunca `console.log` silencioso.
- **Sem**: dark mode, localStorage para dados de usuário, alert/confirm/prompt nativos, `any`.
- **Mobile**: sidebar vira Sheet (overlay), kanban scroll horizontal, calendário só mês.

## Critérios de aceite (do briefing — todos atendidos)

Login Supabase ✓ · Sidebar CRUD + reorder ✓ · Dashboard com dados reais ✓ · Kanban drag&drop + realtime ✓ · Calendário 3 views ✓ · Chat Gemini com histórico ✓ · Lembretes CRUD + realtime ✓ · Reuniões sync calendário ✓ · Brainstorm 3 views ✓ · Perfil + avatar upload ✓ · Zero alert/confirm/localStorage ✓ · Responsivo 375/768/1440 ✓ · Forms com Zod ✓ · Loading states + toasts ✓.

## Pergunta antes de começar

Briefing está muito completo — uma única confirmação: **posso começar pela Fase 1 e seguir nas demais nas próximas mensagens?** É um projeto grande (≈40+ arquivos, 3 fases). Fazer tudo num único turno arrisca builds quebradas. Recomendo entregar fase por fase, validando cada uma no preview antes de seguir.
