import { Outlet } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";
import { motion } from "framer-motion";

export function AppLayout({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="px-4 md:px-8 py-6 md:py-8 pt-16 md:pt-8 max-w-7xl mx-auto"
        >
          {children ?? <Outlet />}
        </motion.div>
      </main>
    </div>
  );
}
