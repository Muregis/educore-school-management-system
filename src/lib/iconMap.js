import { NAV, NAV_EXTRAS } from './constants.js';
import {
  BarChart3,
  FileBarChart,
  Users,
  GraduationCap,
  Building,
  User,
  CheckSquare,
  Scale,
  BookOpen,
  ClipboardList,
  ScrollText,
  PenTool,
  DollarSign,
  Wallet,
  Smartphone,
  CreditCard,
  TrendingUp,
  MessageSquare,
  Calendar,
  Search,
  Lock,
  Library,
  Megaphone,
  FolderOpen,
  Settings,
  LayoutDashboard
} from 'lucide-react';

// Emoji to Lucide React icon mapping
export const EMOJI_TO_ICON = {
  // Dashboard & Analytics
  '\u{1F4CA}': BarChart3, // 📊 - Dashboard, Grades, Reports, Chart of Accounts, Balance Sheet
  '\u{1F4C8}': FileBarChart, // 📈 - Analytics, Income Statement
  
  // People
  '\u{1F465}': Users, // 👥 - Students
  '\u{1F9D1}\u200D\u{1F3EB}': GraduationCap, // 🧑‍🏫 - Teachers
  '\u{1F3EB}': Building, // 🏫 - Staff
  '\u{1F9D1}': User, // 🧑 - HR
  
  // Actions & Status
  '\u2714': CheckSquare, // ✔ - Attendance
  '\u2696': Scale, // ⚖️ - Discipline, Trial Balance
  
  // Content & Documents
  '\u{1F4D6}': BookOpen, // 📖 - Subjects, General Ledger
  '\u{1F4CB}': ClipboardList, // 📋 - Admissions
  '\u{1F4C4}': ScrollText, // 📄 - Report Cards
  '\u{1F4DD}': PenTool, // 📝 - Exams, Update Requests, Journal Entries, Lesson Plans
  
  // Finance
  '\u{1F4B3}': DollarSign, // 💳 - Fees
  '\u{1F4B8}': Wallet, // 💸 - Expenditures
  '\u{1F4F2}': Smartphone, // 📲 - M-Pesa Reconcile
  '\u{1F9FE}': CreditCard, // 🧾 - Invoices
  '\u{1F4B0}': TrendingUp, // 💰 - Financial Reports
  
  // Communication
  '\u{1F4AC}': MessageSquare, // 💬 - Communication
  
  // Time & Planning
  '\u{1F5D3}': Calendar, // 🗓️ - Timetable
  
  // Search & Analysis
  '\u{1F50D}': Search, // 🔍 - Analysis
  
  // Security & Access
  '\u{1F511}': Lock, // 🔒 - Accounts
  
  // Library
  '\u{1F4DA}': Library, // 📚 - Library
  
  // Announcements
  '\u{1F4E2}': Megaphone, // 📢 - Announcements
  
  // Files & Import/Export
  '\u{1F4C1}': FolderOpen, // 📁 - Import/Export
  
  // Settings
  '\u2699': Settings, // ⚙️ - Settings
};

// Fallback icon for unmapped emojis
export const DEFAULT_ICON = LayoutDashboard;

// Get Lucide icon component from emoji
export function getIconFromEmoji(emoji) {
  return EMOJI_TO_ICON[emoji] || DEFAULT_ICON;
}

// Get icon component by page ID
export function getIconByPageId(pageId) {
  const navItem = [...NAV, ...NAV_EXTRAS].find(item => item.id === pageId);
  return navItem ? getIconFromEmoji(navItem.icon) : DEFAULT_ICON;
}

// Re-export NAV and NAV_EXTRAS for convenience
export { NAV, NAV_EXTRAS };
