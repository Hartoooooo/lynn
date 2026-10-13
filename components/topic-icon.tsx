import {
  Banknote,
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  CandlestickChart,
  Clock,
  Folder,
  Globe,
  Landmark,
  Lightbulb,
  ListOrdered,
  type LucideIcon,
  Megaphone,
  PieChart,
  Receipt,
  Scale,
  Server,
  ShieldCheck,
  Star,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";

export const TOPIC_ICONS: Record<string, LucideIcon> = {
  folder: Folder,
  "trending-up": TrendingUp,
  "candlestick-chart": CandlestickChart,
  "bar-chart": BarChart3,
  "pie-chart": PieChart,
  landmark: Landmark,
  banknote: Banknote,
  receipt: Receipt,
  "list-ordered": ListOrdered,
  clock: Clock,
  calendar: Calendar,
  "shield-check": ShieldCheck,
  scale: Scale,
  server: Server,
  wrench: Wrench,
  globe: Globe,
  building: Building2,
  briefcase: Briefcase,
  users: Users,
  megaphone: Megaphone,
  "book-open": BookOpen,
  lightbulb: Lightbulb,
  star: Star,
};

export const TOPIC_COLORS = [
  "#d97757",
  "#e0a050",
  "#c99a4b",
  "#8fb573",
  "#5fae9b",
  "#6a9bcc",
  "#7c8fd6",
  "#a58bd0",
  "#cf7fa8",
  "#a6a39a",
];

export function TopicIcon({
  name,
  color,
  size = 16,
  className,
}: {
  name: string;
  color?: string;
  size?: number;
  className?: string;
}) {
  const Icon = TOPIC_ICONS[name] ?? Folder;
  return <Icon size={size} style={color ? { color } : undefined} className={className} aria-hidden />;
}
