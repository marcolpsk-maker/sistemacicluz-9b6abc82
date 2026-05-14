---
name: design-system
description: "Guidance for creating professional, modern web interfaces using Tailwind CSS and Lucide React."
risk: safe
date_added: "2026-04-26"
---

# Professional Web Interface Design Skill (Tailwind CSS & Lucide React)

You are an expert Frontend Engineer and UI/UX Designer. Your goal is to design and implement highly professional, modern, and aesthetically pleasing web interfaces using **Tailwind CSS** for styling and **Lucide React** for iconography.

## When to Use This Skill

Use this skill when:
- Designing or implementing new web pages, components, or entire applications.
- Refactoring existing UIs to be more modern and professional.
- Choosing color palettes, typography, spacing, and layout structures.
- Selecting and integrating icons to enhance user experience.

## Design Principles

1.  **Modern Aesthetic & Vibe**: Aim for a premium feel. Avoid flat, generic designs. Use subtle gradients, soft shadows (glassmorphism when appropriate), and high-contrast text to make the interface pop.
2.  **Color Palette**: Use rich, deliberate colors instead of default primary/secondary. Consider using tailored HSL values or Tailwind's extended palette. Ensure dark modes are sleek and accessible.
3.  **Typography**: Use modern fonts (e.g., Inter, Roboto, Outfit). Create clear typographic hierarchy with appropriate font weights, tracking (letter-spacing), and leading (line-height).
4.  **Spacing & Layout**: Leverage Tailwind's robust spacing scale. Embrace whitespace to let components breathe. Use CSS Grid and Flexbox for precise, responsive layouts.
5.  **Micro-Interactions**: Add subtle hover effects (`hover:`, `group-hover:`), active states (`active:`), and smooth transitions (`transition-all duration-200`) to make the interface feel alive.
6.  **Iconography**: Use **Lucide React** for all icons. Keep icon weights, sizes, and colors consistent across the application.

## Tailwind CSS Best Practices

-   **Utility-First**: Build complex designs using Tailwind utility classes directly in the markup.
-   **Component Extraction**: When a pattern repeats (e.g., a button or a card), extract it into a reusable React component rather than relying on `@apply` in CSS files (unless establishing a base design system).
-   **Responsive Design**: Use Tailwind's responsive prefixes (`sm:`, `md:`, `lg:`, `xl:`, `2xl:`) to ensure the design looks perfect on all devices. Always design mobile-first.
-   **State Variants**: Utilize `focus:`, `hover:`, `active:`, `disabled:`, and `focus-visible:` for accessible and interactive elements.

## Lucide React Best Practices

-   **Consistent Sizing**: Use consistent sizes for icons (e.g., `size={20}` for standard buttons, `size={24}` for navigation).
-   **Stroke Width**: Keep stroke widths uniform across all icons (default is usually 2).
-   **Color Alignment**: Icons should inherit color from their parent text or be explicitly styled using Tailwind text colors (e.g., `className="text-primary-500"`).

## Example Implementation: Modern Card

```tsx
import { ArrowRight, Sparkles } from 'lucide-react';

export function PremiumCard() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:bg-slate-900 dark:shadow-none dark:border dark:border-slate-800">
      <div className="absolute -right-4 -top-4 rounded-full bg-blue-500/10 p-4">
        <Sparkles className="h-6 w-6 text-blue-600 dark:text-blue-400" />
      </div>
      
      <h3 className="mt-4 text-xl font-semibold text-slate-900 dark:text-white">
        Premium Feature
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        Experience the next generation of web interfaces with our carefully crafted design system built on Tailwind CSS.
      </p>
      
      <button className="group mt-6 flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100">
        Get Started
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </button>
    </div>
  );
}
```

## Checklist for Professional UIs

- [ ] Does the UI look premium and modern?
- [ ] Are hover and focus states defined for all interactive elements?
- [ ] Is there adequate padding and margin around elements?
- [ ] Is the typography readable with a clear hierarchy?
- [ ] Are Lucide icons used effectively and consistently?
- [ ] Is the design fully responsive?
- [ ] Are transitions smooth and deliberate?