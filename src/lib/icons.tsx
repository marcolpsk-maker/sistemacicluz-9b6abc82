import {
  LayoutDashboard, Bell, Calendar, Bot, Video, Brain, User, Settings,
  Folder, FileText, BarChart3, Target, Zap, Star, Heart, KanbanSquare,
  ClipboardList, Lightbulb, Rocket, Briefcase, MessageSquare, Globe,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  "kanban-square": KanbanSquare,
  "bell": Bell,
  "calendar": Calendar,
  "bot": Bot,
  "video": Video,
  "brain": Brain,
  "user": User,
  "settings": Settings,
  "folder": Folder,
  "file-text": FileText,
  "chart-bar": BarChart3,
  "target": Target,
  "zap": Zap,
  "star": Star,
  "heart": Heart,
  "clipboard-list": ClipboardList,
  "lightbulb": Lightbulb,
  "rocket": Rocket,
  "briefcase": Briefcase,
  "message-square": MessageSquare,
  "globe": Globe,
};

export function getIcon(name: string): LucideIcon {
  return MAP[name] ?? Folder;
}
