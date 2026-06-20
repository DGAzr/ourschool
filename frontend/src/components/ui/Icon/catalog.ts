/*
 * OurSchool - Homeschool Management System
 * Copyright (C) 2025 Dustan Ashley
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Curated icon catalog for OurSchool.
 *
 * Icons are statically imported from lucide-react so the bundle only contains
 * what this catalog references. Search keywords allow the picker to surface
 * icons by topic rather than just name.
 *
 * All icon names must exactly match a lucide-react v0.224 export.
 */

import {
  Activity,
  Atom,
  Award,
  BarChart3,
  Beaker,
  Bell,
  BookMarked,
  BookOpen,
  Bookmark,
  Brain,
  Brush,
  Calendar,
  Calculator,
  Camera,
  CheckCircle,
  CheckSquare,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Cloud,
  Code,
  Code2,
  Coffee,
  Compass,
  Cpu,
  Database,
  Dumbbell,
  Eye,
  FileCheck,
  FileCode,
  FileText,
  Flag,
  Flame,
  FlaskConical,
  Frown,
  Gift,
  Globe,
  Globe2,
  GraduationCap,
  Grid,
  Hammer,
  Hash,
  Headphones,
  Heart,
  HelpCircle,
  Hexagon,
  Home,
  Image,
  Infinity,
  Key,
  Landmark,
  Languages,
  Layers,
  Leaf,
  Library,
  Lightbulb,
  List,
  ListChecks,
  Lock,
  Mail,
  Map as MapIcon,
  Medal,
  Meh,
  Mic,
  Microscope,
  Monitor,
  Moon,
  Mountain,
  Music,
  Music2,
  Navigation,
  Package,
  Paintbrush,
  Palette,
  Pen,
  PenLine,
  PenTool,
  Pencil,
  Phone,
  PieChart,
  Play,
  Printer,
  Ruler,
  Save,
  Search,
  Server,
  Settings,
  Shield,
  Smile,
  Star,
  Sun,
  Tag,
  Target,
  Trophy,
  Type,
  User,
  Users,
  Video,
  Wind,
  Zap,
  type LucideIcon,
} from 'lucide-react'

export interface CatalogEntry {
  /** Lucide icon name stored in the database */
  name: string
  /** The lucide-react component */
  Comp: LucideIcon
  /** Search keywords; the name itself is always searched */
  keywords: string[]
}

const CATALOG: CatalogEntry[] = [
  // ── Subjects ────────────────────────────────────────────────────────────
  { name: 'book-open',       Comp: BookOpen,       keywords: ['read', 'textbook', 'subject', 'study', 'class'] },
  { name: 'book-marked',     Comp: BookMarked,     keywords: ['read', 'textbook', 'marked', 'literature', 'class'] },
  { name: 'library',         Comp: Library,        keywords: ['books', 'reading', 'collection', 'reference'] },
  { name: 'graduation-cap',  Comp: GraduationCap,  keywords: ['school', 'graduate', 'degree', 'education', 'learn'] },
  { name: 'calculator',      Comp: Calculator,     keywords: ['math', 'mathematics', 'arithmetic', 'numbers'] },
  { name: 'atom',            Comp: Atom,           keywords: ['science', 'physics', 'chemistry', 'element', 'molecule'] },
  { name: 'flask-conical',   Comp: FlaskConical,   keywords: ['science', 'chemistry', 'lab', 'experiment', 'test tube'] },
  { name: 'beaker',          Comp: Beaker,         keywords: ['science', 'chemistry', 'lab', 'biology', 'experiment'] },
  { name: 'microscope',      Comp: Microscope,     keywords: ['science', 'biology', 'lab', 'cells', 'research'] },
  { name: 'globe',           Comp: Globe,          keywords: ['geography', 'world', 'social studies', 'history', 'earth', 'map'] },
  { name: 'globe-2',         Comp: Globe2,         keywords: ['geography', 'world', 'social studies', 'history', 'earth'] },
  { name: 'map',             Comp: MapIcon,        keywords: ['geography', 'social studies', 'history', 'navigation'] },
  { name: 'landmark',        Comp: Landmark,       keywords: ['history', 'social studies', 'geography', 'government'] },
  { name: 'music',           Comp: Music,          keywords: ['music', 'song', 'notes', 'band', 'choir', 'instrument'] },
  { name: 'music-2',         Comp: Music2,         keywords: ['music', 'song', 'notes', 'instrument'] },
  { name: 'headphones',      Comp: Headphones,     keywords: ['music', 'audio', 'listen', 'sound', 'ear'] },
  { name: 'palette',         Comp: Palette,        keywords: ['art', 'paint', 'color', 'drawing', 'creative', 'design'] },
  { name: 'paintbrush',      Comp: Paintbrush,     keywords: ['art', 'paint', 'draw', 'creative', 'color', 'design'] },
  { name: 'brush',           Comp: Brush,          keywords: ['art', 'paint', 'draw', 'creative', 'design'] },
  { name: 'pen-tool',        Comp: PenTool,        keywords: ['design', 'drawing', 'art', 'vector', 'creative', 'write'] },
  { name: 'image',           Comp: Image,          keywords: ['art', 'photo', 'picture', 'visual', 'drawing'] },
  { name: 'code',            Comp: Code,           keywords: ['programming', 'computer science', 'coding', 'tech', 'software'] },
  { name: 'code-2',          Comp: Code2,          keywords: ['programming', 'computer science', 'coding', 'tech', 'software'] },
  { name: 'cpu',             Comp: Cpu,            keywords: ['computer science', 'tech', 'processor', 'hardware'] },
  { name: 'monitor',         Comp: Monitor,        keywords: ['computer', 'screen', 'tech', 'display', 'programming'] },
  { name: 'dumbbell',        Comp: Dumbbell,       keywords: ['pe', 'physical education', 'gym', 'exercise', 'sport', 'fitness'] },
  { name: 'mountain',        Comp: Mountain,       keywords: ['pe', 'outdoors', 'nature', 'geography', 'physical'] },
  { name: 'wind',            Comp: Wind,           keywords: ['science', 'weather', 'nature', 'pe', 'outdoors'] },
  { name: 'languages',       Comp: Languages,      keywords: ['foreign language', 'spanish', 'french', 'latin', 'language arts', 'english'] },
  { name: 'type',            Comp: Type,           keywords: ['english', 'language arts', 'writing', 'grammar', 'text', 'font'] },
  { name: 'brain',           Comp: Brain,          keywords: ['psychology', 'thinking', 'intelligence', 'mind', 'cognition'] },
  { name: 'lightbulb',       Comp: Lightbulb,      keywords: ['idea', 'thinking', 'creative', 'science', 'learn'] },
  { name: 'ruler',           Comp: Ruler,          keywords: ['math', 'geometry', 'measure', 'design', 'draw'] },
  { name: 'compass',         Comp: Compass,        keywords: ['math', 'geometry', 'navigation', 'geography', 'draw'] },

  // ── Assignment types ──────────────────────────────────────────────────
  { name: 'pencil',          Comp: Pencil,         keywords: ['homework', 'write', 'assignment', 'task', 'work'] },
  { name: 'pen-line',        Comp: PenLine,        keywords: ['homework', 'write', 'assignment', 'task', 'work'] },
  { name: 'pen',             Comp: Pen,            keywords: ['write', 'essay', 'homework', 'assignment', 'task'] },
  { name: 'file-text',       Comp: FileText,       keywords: ['worksheet', 'document', 'paper', 'assignment', 'test'] },
  { name: 'file-check',      Comp: FileCheck,      keywords: ['quiz', 'test', 'graded', 'complete', 'assignment'] },
  { name: 'file-code',       Comp: FileCode,       keywords: ['coding', 'programming', 'project', 'computer science'] },
  { name: 'clipboard-check', Comp: ClipboardCheck, keywords: ['quiz', 'test', 'graded', 'checklist', 'assessment'] },
  { name: 'clipboard-list',  Comp: ClipboardList,  keywords: ['worksheet', 'checklist', 'assignment', 'list', 'task'] },
  { name: 'list-checks',     Comp: ListChecks,     keywords: ['checklist', 'worksheet', 'tasks', 'complete'] },
  { name: 'bar-chart-3',     Comp: BarChart3,      keywords: ['test', 'grade', 'score', 'data', 'results', 'statistics'] },
  { name: 'pie-chart',       Comp: PieChart,       keywords: ['grade', 'data', 'statistics', 'results', 'math'] },
  { name: 'help-circle',     Comp: HelpCircle,     keywords: ['quiz', 'question', 'unknown', 'assessment', 'test'] },
  { name: 'target',          Comp: Target,         keywords: ['practice', 'goal', 'aim', 'focus', 'skill'] },
  { name: 'hammer',          Comp: Hammer,         keywords: ['project', 'build', 'make', 'construct', 'create'] },
  { name: 'mic',             Comp: Mic,            keywords: ['presentation', 'speech', 'speak', 'oral', 'record'] },
  { name: 'video',           Comp: Video,          keywords: ['presentation', 'record', 'video project', 'film'] },
  { name: 'play',            Comp: Play,           keywords: ['presentation', 'video', 'performance', 'play', 'start'] },
  { name: 'award',           Comp: Award,          keywords: ['project', 'achievement', 'grade', 'reward', 'trophy'] },
  { name: 'trophy',          Comp: Trophy,         keywords: ['achievement', 'award', 'grade', 'win', 'success'] },
  { name: 'medal',           Comp: Medal,          keywords: ['achievement', 'award', 'grade', 'win', 'success'] },
  { name: 'star',            Comp: Star,           keywords: ['favorite', 'grade', 'achievement', 'reward', 'important'] },

  // ── General purpose ──────────────────────────────────────────────────
  { name: 'bookmark',        Comp: Bookmark,       keywords: ['save', 'mark', 'reference', 'important', 'note'] },
  { name: 'tag',             Comp: Tag,            keywords: ['label', 'category', 'mark', 'type', 'topic'] },
  { name: 'flag',            Comp: Flag,           keywords: ['goal', 'mark', 'important', 'milestone', 'alert'] },
  { name: 'check-circle',    Comp: CheckCircle,    keywords: ['done', 'complete', 'success', 'finish', 'check'] },
  { name: 'check-square',    Comp: CheckSquare,    keywords: ['done', 'complete', 'task', 'check', 'finish'] },
  { name: 'clock',           Comp: Clock,          keywords: ['time', 'schedule', 'duration', 'timer', 'deadline'] },
  { name: 'calendar',        Comp: Calendar,       keywords: ['schedule', 'date', 'plan', 'time', 'event'] },
  { name: 'bell',            Comp: Bell,           keywords: ['reminder', 'alert', 'notify', 'important', 'notice'] },
  { name: 'heart',           Comp: Heart,          keywords: ['favorite', 'like', 'love', 'interest', 'fun'] },
  { name: 'smile',           Comp: Smile,          keywords: ['mood', 'happy', 'good', 'positive', 'emotion', 'journal'] },
  { name: 'meh',             Comp: Meh,            keywords: ['mood', 'okay', 'neutral', 'emotion', 'journal'] },
  { name: 'frown',           Comp: Frown,          keywords: ['mood', 'sad', 'hard', 'difficult', 'emotion', 'journal'] },
  { name: 'flame',           Comp: Flame,          keywords: ['hot', 'important', 'urgent', 'fire', 'energy'] },
  { name: 'zap',             Comp: Zap,            keywords: ['fast', 'energy', 'power', 'quick', 'electric', 'spark'] },
  { name: 'sun',             Comp: Sun,            keywords: ['bright', 'morning', 'science', 'energy', 'warm', 'nature'] },
  { name: 'moon',            Comp: Moon,           keywords: ['night', 'dark', 'science', 'astronomy', 'space'] },
  { name: 'cloud',           Comp: Cloud,          keywords: ['weather', 'science', 'nature', 'sky', 'storage'] },
  { name: 'leaf',            Comp: Leaf,           keywords: ['nature', 'science', 'biology', 'plant', 'garden', 'ecology'] },
  { name: 'home',            Comp: Home,           keywords: ['home', 'house', 'life skills', 'family', 'domestic'] },
  { name: 'coffee',          Comp: Coffee,         keywords: ['break', 'morning', 'drink', 'relax', 'home economics'] },
  { name: 'gift',            Comp: Gift,           keywords: ['reward', 'bonus', 'special', 'incentive'] },
  { name: 'navigation',      Comp: Navigation,     keywords: ['geography', 'location', 'map', 'direction', 'explore'] },
  { name: 'layers',          Comp: Layers,         keywords: ['depth', 'complex', 'structure', 'build', 'organize'] },
  { name: 'list',            Comp: List,           keywords: ['organize', 'outline', 'note', 'plan', 'worksheet'] },
  { name: 'grid',            Comp: Grid,           keywords: ['organize', 'structure', 'layout', 'plan', 'table'] },
  { name: 'hash',            Comp: Hash,           keywords: ['number', 'id', 'math', 'count', 'tag'] },
  { name: 'infinity',        Comp: Infinity,       keywords: ['math', 'endless', 'concept', 'philosophy', 'forever'] },
  { name: 'hexagon',         Comp: Hexagon,        keywords: ['math', 'geometry', 'shape', 'science', 'pattern'] },
  { name: 'activity',        Comp: Activity,       keywords: ['health', 'pe', 'exercise', 'vital', 'stats', 'science'] },
  { name: 'shield',          Comp: Shield,         keywords: ['protect', 'safety', 'security', 'health', 'safe'] },
  { name: 'settings',        Comp: Settings,       keywords: ['configure', 'manage', 'admin', 'options', 'tools'] },
  { name: 'search',          Comp: Search,         keywords: ['find', 'research', 'look', 'discover', 'investigate'] },
  { name: 'eye',             Comp: Eye,            keywords: ['observe', 'watch', 'science', 'vision', 'look'] },
  { name: 'mail',            Comp: Mail,           keywords: ['communication', 'language arts', 'write', 'message'] },
  { name: 'phone',           Comp: Phone,          keywords: ['communication', 'call', 'contact', 'life skills'] },
  { name: 'camera',          Comp: Camera,         keywords: ['photo', 'art', 'media', 'project', 'science'] },
  { name: 'printer',         Comp: Printer,        keywords: ['print', 'worksheet', 'paper', 'output'] },
  { name: 'save',            Comp: Save,           keywords: ['save', 'store', 'keep', 'record', 'disk'] },
  { name: 'lock',            Comp: Lock,           keywords: ['security', 'private', 'protect', 'secret', 'safe'] },
  { name: 'key',             Comp: Key,            keywords: ['access', 'unlock', 'solution', 'answer', 'secret'] },
  { name: 'package',         Comp: Package,        keywords: ['project', 'bundle', 'unit', 'module', 'collection'] },
  { name: 'server',          Comp: Server,         keywords: ['tech', 'computer science', 'database', 'network'] },
  { name: 'database',        Comp: Database,       keywords: ['tech', 'computer science', 'data', 'storage', 'information'] },
  { name: 'users',           Comp: Users,          keywords: ['social', 'group', 'team', 'class', 'people', 'community'] },
  { name: 'user',            Comp: User,           keywords: ['student', 'person', 'individual', 'profile'] },
]

/** O(1) lookup map: icon name → catalog entry */
export const CATALOG_MAP: Record<string, CatalogEntry> = Object.fromEntries(
  CATALOG.map(entry => [entry.name, entry])
)

export default CATALOG
