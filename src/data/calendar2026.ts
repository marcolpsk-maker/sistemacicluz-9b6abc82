
export interface CalendarEvent {
    date: string; // YYYY-MM-DD
    title: string;
    type: 'feriado' | 'ponto_facultativo' | 'comemorativa' | 'evento_global' | 'evento_politico';
    colorToken: string; // Tailind class like 'bg-red-500'
    priority: 'high' | 'medium' | 'low';
    tags?: string[];
}

export const CALENDAR_EVENTS_2026: Record<string, CalendarEvent[]> = {
    // FERIADOS OFICIAIS BRASIL 2026
    "2026-01-01": [{ date: "2026-01-01", title: "Confraternização Universal", type: "feriado", colorToken: "bg-red-500", priority: "high" }],
    "2026-02-16": [{ date: "2026-02-16", title: "Carnaval", type: "ponto_facultativo", colorToken: "bg-amber-500", priority: "medium" }],
    "2026-02-17": [{ date: "2026-02-17", title: "Carnaval", type: "ponto_facultativo", colorToken: "bg-amber-500", priority: "medium" }],
    "2026-02-18": [{ date: "2026-02-18", title: "Quarta-Feira de Cinzas", type: "ponto_facultativo", colorToken: "bg-zinc-500", priority: "low" }],
    "2026-04-03": [{ date: "2026-04-03", title: "Paixão de Cristo", type: "feriado", colorToken: "bg-red-500", priority: "high" }],
    "2026-04-20": [{ date: "2026-04-20", title: "Ponto Facultativo", type: "ponto_facultativo", colorToken: "bg-amber-500", priority: "low" }],
    "2026-04-21": [{ date: "2026-04-21", title: "Tiradentes", type: "feriado", colorToken: "bg-red-500", priority: "high" }],
    "2026-05-01": [{ date: "2026-05-01", title: "Dia Mundial do Trabalho", type: "feriado", colorToken: "bg-red-500", priority: "high" }],
    "2026-06-04": [{ date: "2026-06-04", title: "Corpus Christi", type: "ponto_facultativo", colorToken: "bg-amber-500", priority: "medium" }],
    "2026-06-05": [{ date: "2026-06-05", title: "Ponto Facultativo", type: "ponto_facultativo", colorToken: "bg-amber-500", priority: "low" }],
    "2026-09-07": [{ date: "2026-09-07", title: "Independência do Brasil", type: "feriado", colorToken: "bg-red-500", priority: "high" }],
    "2026-10-12": [{ date: "2026-10-12", title: "Nossa Senhora Aparecida / Dia das Crianças", type: "feriado", colorToken: "bg-red-500", priority: "high", tags: ["crianças", "presente", "brinquedos"] }],
    "2026-10-28": [{ date: "2026-10-28", title: "Dia do Servidor Público", type: "ponto_facultativo", colorToken: "bg-zinc-500", priority: "low" }],
    "2026-11-02": [{ date: "2026-11-02", title: "Finados", type: "feriado", colorToken: "bg-red-500", priority: "high" }],
    "2026-11-15": [{ date: "2026-11-15", title: "Proclamação da República", type: "feriado", colorToken: "bg-red-500", priority: "high" }],
    "2026-11-20": [{ date: "2026-11-20", title: "Consciência Negra", type: "feriado", colorToken: "bg-red-500", priority: "high" }],
    "2026-12-24": [{ date: "2026-12-24", title: "Véspera de Natal", type: "ponto_facultativo", colorToken: "bg-amber-500", priority: "medium" }],
    "2026-12-25": [{ date: "2026-12-25", title: "Natal", type: "feriado", colorToken: "bg-red-500", priority: "high", tags: ["familia", "bordado", "presente"] }],
    "2026-12-31": [{ date: "2026-12-31", title: "Véspera de Ano Novo", type: "ponto_facultativo", colorToken: "bg-amber-500", priority: "medium" }],

    // ELEIÇÕES 2026
    "2026-10-04": [{ date: "2026-10-04", title: "Eleições 2026 - 1º Turno", type: "evento_politico", colorToken: "bg-zinc-800", priority: "high" }],
    "2026-10-25": [{ date: "2026-10-25", title: "Eleições 2026 - 2º Turno", type: "evento_politico", colorToken: "bg-zinc-800", priority: "high" }],

    // COPA DO MUNDO 2026
    "2026-06-11": [{ date: "2026-06-11", title: "Copa do Mundo FIFA 2026 - Abertura", type: "evento_global", colorToken: "bg-blue-600", priority: "high" }],
    "2026-07-19": [{ date: "2026-07-19", title: "Copa do Mundo FIFA 2026 - Final", type: "evento_global", colorToken: "bg-blue-600", priority: "high" }],

    // PESSART COMERCIAL / COMEMORATIVAS
    "2026-01-06": [{ date: "2026-01-06", title: "Dia de Reis", type: "comemorativa", colorToken: "bg-purple-500", priority: "medium" }],
    "2026-01-30": [{ date: "2026-01-30", title: "Volta às Aulas", type: "comemorativa", colorToken: "bg-purple-500", priority: "medium", tags: ["mochilas", "estojos", "bordado"] }],
    "2026-02-14": [{ date: "2026-02-14", title: "Valentine's Day", type: "comemorativa", colorToken: "bg-pink-500", priority: "high", tags: ["casal", "afeto", "personalizado"] }],
    "2026-02-28": [{ date: "2026-02-28", title: "Pré-campanha Dia da Mulher", type: "comemorativa", colorToken: "bg-pink-400", priority: "medium" }],
    "2026-03-08": [{ date: "2026-03-08", title: "Dia Internacional da Mulher", type: "comemorativa", colorToken: "bg-pink-600", priority: "high", tags: ["brindes", "bordado", "homenagem"] }],
    "2026-03-15": [{ date: "2026-03-15", title: "Dia do Consumidor", type: "comemorativa", colorToken: "bg-blue-500", priority: "medium" }],
    "2026-03-20": [{ date: "2026-03-20", title: "Início do Outono", type: "comemorativa", colorToken: "bg-orange-500", priority: "low" }],
    "2026-04-05": [{ date: "2026-04-05", title: "Páscoa", type: "comemorativa", colorToken: "bg-purple-500", priority: "high", tags: ["bordado", "lembranças"] }],
    "2026-04-12": [{ date: "2026-04-12", title: "Dia do Beijo", type: "comemorativa", colorToken: "bg-pink-400", priority: "low" }],
    "2026-05-10": [{ date: "2026-05-10", title: "Dia das Mães", type: "comemorativa", colorToken: "bg-pink-600", priority: "high", tags: ["bordado", "personalizado", "presente"] }],
    "2026-05-25": [{ date: "2026-05-25", title: "Dia do Orgulho Geek", type: "comemorativa", colorToken: "bg-blue-500", priority: "medium" }],
    "2026-05-31": [{ date: "2026-05-31", title: "Pré-campanha Dia dos Namorados", type: "comemorativa", colorToken: "bg-pink-400", priority: "medium" }],
    "2026-06-12": [{ date: "2026-06-12", title: "Dia dos Namorados", type: "comemorativa", colorToken: "bg-pink-600", priority: "high", tags: ["casal", "personalizado", "kit"] }],
    "2026-06-24": [{ date: "2026-06-24", title: "São João", type: "comemorativa", colorToken: "bg-orange-600", priority: "medium" }],
    "2026-07-20": [{ date: "2026-07-20", title: "Dia do Amigo", type: "comemorativa", colorToken: "bg-blue-400", priority: "medium" }],
    "2026-07-26": [{ date: "2026-07-26", title: "Dia dos Avós", type: "comemorativa", colorToken: "bg-purple-600", priority: "high", tags: ["afeto", "bordado", "memória"] }],
    "2026-08-09": [{ date: "2026-08-09", title: "Dia dos Pais", type: "comemorativa", colorToken: "bg-blue-600", priority: "high", tags: ["bordado", "personalizado", "presente"] }],
    "2026-08-26": [{ date: "2026-08-26", title: "Dia Internacional do Cachorro", type: "comemorativa", colorToken: "bg-amber-600", priority: "high", tags: ["pet", "bordado", "coleira"] }],
    "2026-09-15": [{ date: "2026-09-15", title: "Dia do Cliente", type: "comemorativa", colorToken: "bg-blue-700", priority: "high" }],
    "2026-10-15": [{ date: "2026-10-15", title: "Dia dos Professores", type: "comemorativa", colorToken: "bg-purple-500", priority: "medium", tags: ["presente", "bordado"] }],
    "2026-10-31": [{ date: "2026-10-31", title: "Halloween", type: "comemorativa", colorToken: "bg-orange-700", priority: "low" }],
    "2026-11-27": [{ date: "2026-11-27", title: "Black Friday", type: "comemorativa", colorToken: "bg-zinc-900", priority: "high", tags: ["promoção", "vendas"] }],
};
