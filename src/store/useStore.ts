import { create } from 'zustand';
import { Node, Edge, Connection, addEdge, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange } from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';
import { saveNodes, saveEdges, loadNodes, loadEdges, saveAppState, loadAppState } from '@/lib/storage';

// Тип темы приложения
export type AppTheme = {
  background: string; // CSS градиент или цвет
  backgroundImage?: string; // URL или data URL фоновой картинки
  backgroundHtml?: string; // Содержимое HTML файла для фона
  glowColor: string; // Цвет свечения
  panelTransparency: number; // Прозрачность панелей (0-1)
  interfaceFont: string; // Шрифт интерфейса
  themeBrightness: number; // Яркость темы (0-1)
  accentColor: string; // Акцентный цвет (HEX)
};

// Тип пользовательского шрифта
export type CustomFont = {
  name: string;
  data: string; // Data URL файла шрифта
};

// Тип пользовательской ссылки
export type CustomLink = {
  id: string;
  name: string;
  url: string;
};

// Состояние приложения
interface AppState {
  nodes: Node[];
  edges: Edge[];
  theme: AppTheme;
  gridEnabled: boolean;
  snapToGrid: boolean;
  customFonts: CustomFont[];
  systemFonts: string[]; // Список системных шрифтов
  customLinks: CustomLink[];
  language: 'ru' | 'en'; // Текущий язык интерфейса
  isReadingMode: boolean; // Режим чтения (полноэкранный)
  
  // Действия (Actions)
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (type: string, position: { x: number, y: number }, data?: any, skipHistory?: boolean) => string;
  addEdge: (edge: Edge, skipHistory?: boolean) => void;
  updateNodeData: (id: string, data: any, skipHistory?: boolean) => void;
  pushHistory: () => void;
  deleteNode: (id: string) => void;
  setTheme: (theme: AppTheme) => void;
  setBackgroundImage: (image: string | undefined) => void;
  setBackgroundHtml: (html: string | undefined) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  toggleLanguage: () => void;
  addCustomFont: (font: CustomFont) => void;
  setSystemFonts: (fonts: string[]) => void;
  addCustomLink: (link: Omit<CustomLink, 'id'>) => Promise<void>;
  deleteCustomLink: (id: string) => Promise<void>;
  undo: () => void;
  redo: () => void;
  clearCanvas: () => void;
  setReadingMode: (active: boolean) => void;
  loadFromStorage: () => Promise<void>;
}

const MAX_HISTORY = 50;
let globalHistory: { nodes: Node[], edges: Edge[] }[] = [];
let globalHistoryIndex = -1;

const pushGlobalHistory = (nodes: Node[], edges: Edge[]) => {
  // Копируем данные, чтобы избежать ссылок на одни и те же объекты
  const state = { 
    nodes: JSON.parse(JSON.stringify(nodes)), 
    edges: JSON.parse(JSON.stringify(edges)) 
  };
  
  if (globalHistoryIndex < globalHistory.length - 1) {
    globalHistory = globalHistory.slice(0, globalHistoryIndex + 1);
  }
  
  globalHistory.push(state);
  if (globalHistory.length > MAX_HISTORY) {
    globalHistory.shift();
  } else {
    globalHistoryIndex++;
  }
};

const DEFAULT_THEME: AppTheme = {
  background: 'linear-gradient(to bottom right, #09090b, #18181b)',
  glowColor: '#3b82f6',
  panelTransparency: 0.8,
  interfaceFont: 'Inter',
  themeBrightness: 0,
  accentColor: '#3b82f6',
};

// Создание хранилища состояния
export const useStore = create<AppState>((set, get) => ({
  nodes: [],
  edges: [],
  theme: DEFAULT_THEME,
  gridEnabled: false,
  snapToGrid: false,
  customFonts: [],
  systemFonts: [],
  customLinks: [],
  language: 'ru',
  isReadingMode: false,

  // Обработка изменений узлов
  onNodesChange: (changes) => {
    const newNodes = applyNodeChanges(changes, get().nodes);
    set({ nodes: newNodes });
    saveNodes(newNodes);
    
    // Пушим в историю только если это не перемещение (чтобы не спамить)
    const isMajorChange = changes.some(c => c.type !== 'position');
    if (isMajorChange) {
      pushGlobalHistory(newNodes, get().edges);
    }
  },
  // Обработка изменений связей
  onEdgesChange: (changes) => {
    const newEdges = applyEdgeChanges(changes, get().edges);
    set({ edges: newEdges });
    saveEdges(newEdges);
    pushGlobalHistory(get().nodes, newEdges);
  },
  // Создание новой связи
  onConnect: (connection) => {
    const newEdges = addEdge({ ...connection, type: 'smoothstep', animated: true }, get().edges);
    set({ edges: newEdges });
    saveEdges(newEdges);
    pushGlobalHistory(get().nodes, newEdges);
  },
  // Добавление нового узла
  addNode: (type, position, data = {}, skipHistory = false) => {
    const id = uuidv4();
    const newNode: Node = {
      id,
      type,
      position,
      data: { label: get().language === 'ru' ? 'Новая заметка' : 'New Node', ...data },
      dragHandle: '.custom-drag-handle',
      style: data.initialStyle || { width: 250, height: 350 },
    };
    // Удаляем временное поле стиля из данных
    const { initialStyle, ...cleanData } = data;
    newNode.data = { label: get().language === 'ru' ? 'Новая заметка' : 'New Node', ...cleanData };
    const newNodes = [...get().nodes, newNode];
    set({ nodes: newNodes });
    saveNodes(newNodes);
    if (!skipHistory) {
      pushGlobalHistory(newNodes, get().edges);
    }
    return id;
  },
  // Добавление связи вручную
  addEdge: (edge, skipHistory = false) => {
    const newEdges = addEdge({ ...edge, type: 'smoothstep', animated: true }, get().edges);
    set({ edges: newEdges });
    saveEdges(newEdges);
    if (!skipHistory) {
      pushGlobalHistory(get().nodes, newEdges);
    }
  },
  // Обновление данных узла
  updateNodeData: (id, data, skipHistory = false) => {
    const currentNodes = get().nodes;
    
    const updateRecursive = (nodeId: string, newData: any, visited = new Set<string>()) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      set((state) => ({
        nodes: state.nodes.map((node) => {
          if (node.id === nodeId) {
            return { ...node, data: { ...node.data, ...newData } };
          }
          return node;
        }),
      }));

      // Находим дочерние ноды и обновляем их, если изменился контент
      if (newData.content !== undefined) {
        const children = currentNodes.filter(n => n.data?.parentId === nodeId);
        if (children.length > 0) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(newData.content, 'text/html');
          const headings = Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6'));

          children.forEach(child => {
            if (child.data?.sectionLabel) {
              // Синхронизация по заголовку
              const h = headings.find(h => h.textContent?.trim() === child.data.sectionLabel);
              if (h) {
                let sectionContent = '';
                let next = h.nextElementSibling;
                while (next && !['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(next.tagName)) {
                  sectionContent += next.outerHTML;
                  next = next.nextElementSibling;
                }
                if (sectionContent !== child.data.content) {
                  updateRecursive(child.id, { content: sectionContent }, visited);
                }
              }
            } else {
              // Полная синхронизация для нод без меток секций
              if (newData.content !== child.data.content) {
                updateRecursive(child.id, { content: newData.content }, visited);
              }
            }
          });
        }
      }
    };

    updateRecursive(id, data);
    saveNodes(get().nodes);
    if (!skipHistory) {
      pushGlobalHistory(get().nodes, get().edges);
    }
  },
  pushHistory: () => {
    pushGlobalHistory(get().nodes, get().edges);
  },
  // Удаление узла
  deleteNode: (id) => {
    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
    });
    saveNodes(get().nodes);
    saveEdges(get().edges);
  },
  // Установка темы
  setTheme: (theme) => {
    set({ theme });
    saveAppState({ theme, gridEnabled: get().gridEnabled, snapToGrid: get().snapToGrid, customFonts: get().customFonts, customLinks: get().customLinks, language: get().language });
  },
  // Установка фонового изображения
  setBackgroundImage: (image) => {
    const newTheme = { ...get().theme, backgroundImage: image, backgroundHtml: undefined };
    set({ theme: newTheme });
    saveAppState({ theme: newTheme, gridEnabled: get().gridEnabled, snapToGrid: get().snapToGrid, customFonts: get().customFonts, customLinks: get().customLinks, language: get().language });
  },
  // Установка HTML фона
  setBackgroundHtml: (html) => {
    const newTheme = { ...get().theme, backgroundHtml: html, backgroundImage: undefined };
    set({ theme: newTheme });
    saveAppState({ theme: newTheme, gridEnabled: get().gridEnabled, snapToGrid: get().snapToGrid, customFonts: get().customFonts, customLinks: get().customLinks, language: get().language });
  },
  // Переключение сетки
  toggleGrid: () => {
    const newVal = !get().gridEnabled;
    set({ gridEnabled: newVal });
    saveAppState({ theme: get().theme, gridEnabled: newVal, snapToGrid: get().snapToGrid, customFonts: get().customFonts, customLinks: get().customLinks, language: get().language });
  },
  // Переключение привязки к сетке
  toggleSnap: () => {
    const newVal = !get().snapToGrid;
    set({ snapToGrid: newVal });
    saveAppState({ theme: get().theme, gridEnabled: get().gridEnabled, snapToGrid: newVal, customFonts: get().customFonts, customLinks: get().customLinks, language: get().language });
  },
  // Смена языка
  toggleLanguage: () => {
    const newLang = get().language === 'ru' ? 'en' : 'ru';
    set({ language: newLang });
    saveAppState({ theme: get().theme, gridEnabled: get().gridEnabled, snapToGrid: get().snapToGrid, customFonts: get().customFonts, customLinks: get().customLinks, language: newLang });
  },
  // Добавление шрифта
  addCustomFont: (font) => {
    const newFonts = [...get().customFonts, font];
    set({ customFonts: newFonts });
    saveAppState({ theme: get().theme, gridEnabled: get().gridEnabled, snapToGrid: get().snapToGrid, customFonts: newFonts, customLinks: get().customLinks, language: get().language });
  },
  setSystemFonts: (fonts) => {
    set({ systemFonts: fonts });
  },
  // Добавление ссылки
  addCustomLink: async (link) => {
    const newLinks = [...get().customLinks, { ...link, id: uuidv4() }];
    set({ customLinks: newLinks });
    saveAppState({ theme: get().theme, gridEnabled: get().gridEnabled, snapToGrid: get().snapToGrid, customFonts: get().customFonts, customLinks: newLinks, language: get().language });
    
    // Синхронизация с сервером
    try {
      await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLinks)
      });
    } catch (err) {
      console.error("Failed to sync links to server:", err);
    }
  },
  // Удаление ссылки
  deleteCustomLink: async (id) => {
    const newLinks = get().customLinks.filter(l => l.id !== id);
    set({ customLinks: newLinks });
    saveAppState({ theme: get().theme, gridEnabled: get().gridEnabled, snapToGrid: get().snapToGrid, customFonts: get().customFonts, customLinks: newLinks, language: get().language });
    
    // Синхронизация с сервером
    try {
      await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLinks)
      });
    } catch (err) {
      console.error("Failed to sync links to server:", err);
    }
  },
  // Глобальный Undo
  undo: () => {
    if (globalHistoryIndex > 0) {
      globalHistoryIndex--;
      const prevState = globalHistory[globalHistoryIndex];
      set({ 
        nodes: JSON.parse(JSON.stringify(prevState.nodes)), 
        edges: JSON.parse(JSON.stringify(prevState.edges)) 
      });
      saveNodes(prevState.nodes);
      saveEdges(prevState.edges);
    }
  },
  // Глобальный Redo
  redo: () => {
    if (globalHistoryIndex < globalHistory.length - 1) {
      globalHistoryIndex++;
      const nextState = globalHistory[globalHistoryIndex];
      set({ 
        nodes: JSON.parse(JSON.stringify(nextState.nodes)), 
        edges: JSON.parse(JSON.stringify(nextState.edges)) 
      });
      saveNodes(nextState.nodes);
      saveEdges(nextState.edges);
    }
  },
  // Очистка холста
  clearCanvas: () => {
    if (confirm(get().language === 'ru' ? 'Вы уверены, что хотите очистить весь холст?' : 'Are you sure you want to clear the entire canvas?')) {
      set({ nodes: [], edges: [] });
      saveNodes([]);
      saveEdges([]);
      pushGlobalHistory([], []);
    }
  },
  // Установка режима чтения
  setReadingMode: (active) => {
    set({ isReadingMode: active });
  },
  // Загрузка данных из локального хранилища
  loadFromStorage: async () => {
    const [nodes, edges, appState, serverLinks] = await Promise.all([
      loadNodes(),
      loadEdges(),
      loadAppState(),
      fetch('/api/links').then(res => res.json()).catch(() => [])
    ]);

    if (nodes && nodes.length > 0) set({ nodes });
    if (edges && edges.length > 0) set({ edges });
    
    const customLinks = serverLinks && serverLinks.length > 0 
      ? serverLinks 
      : (appState?.customLinks || []);

    if (appState) {
      set({
        theme: appState.theme || DEFAULT_THEME,
        gridEnabled: appState.gridEnabled ?? true,
        snapToGrid: appState.snapToGrid ?? true,
        customFonts: appState.customFonts || [],
        customLinks: customLinks,
        language: appState.language || 'ru',
      });
    } else if (customLinks.length > 0) {
      set({ customLinks });
    }
  },
}));
