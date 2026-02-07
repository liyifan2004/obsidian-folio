import { App } from 'obsidian';

// 语言定义
export type Language = 
	| 'en'      // English
	| 'zh'      // 简体中文
	| 'zh-TW'   // 繁體中文
	| 'ja'      // 日本語
	| 'ko'      // 한국어
	| 'fr'      // Français
	| 'de'      // Deutsch
	| 'es'      // Español
	| 'ar';     // العربية

// 语言名称
const languageNames: Record<Language, string> = {
	'en': 'English',
	'zh': '简体中文',
	'zh-TW': '繁體中文',
	'ja': '日本語',
	'ko': '한국어',
	'fr': 'Français',
	'de': 'Deutsch',
	'es': 'Español',
	'ar': 'العربية'
};

// 从 Obsidian 语言映射到我们的语言代码
const obsidianLanguageMap: Record<string, Language> = {
	'en': 'en',
	'zh': 'zh',
	'zh-TW': 'zh-TW',
	'ja': 'ja',
	'ko': 'ko',
	'fr': 'fr',
	'de': 'de',
	'es': 'es',
	'ar': 'ar'
};

// 翻译数据
const translations: Record<Language, Record<string, string>> = {
	// 英语
	en: {
		// 设置
		'settingOverlap': 'Content Overlap',
		'settingOverlapDesc': 'Number of lines of overlap between panes (0-10)',
		'settingLanguage': 'Language',
		'settingLanguageDesc': 'Display language (auto-detected by default)',
		'settingHotkeys': 'Hotkeys',
		'settingHotkeysDesc': 'Configure keyboard shortcuts in Obsidian Settings → Hotkeys',
		
		// 命令
		'cmdToggle': 'Toggle Dual Pane Mode',
		'cmdToggleTriple': 'Toggle Triple Pane Mode',
		'cmdStop': 'Stop Synchronized Reading',
		'cmdPageUp': 'Page Up (Both Panes)',
		'cmdPageDown': 'Page Down (Both Panes)',
		'cmdDoublePageUp': 'Double Page Up',
		'cmdDoublePageDown': 'Double Page Down',
		
		// 菜单
		'menuDualMode': 'Dual Pane Mode',
		'menuTripleMode': 'Triple Pane Mode',
		'menuStop': 'Stop',
		
		// 通知
		'noticeNeedFile': 'Please open a file first',
		'noticeNotSupported': 'Current view type not supported',
		'noticeLeftClosed': 'Left pane closed, stop following',
		'noticeRightClosed': 'Right pane closed, stop following',
		'noticeStopped': 'Synchronized reading stopped',
		'noticeDualStarted': 'Dual pane mode started',
		'noticeTripleStarted': 'Triple pane mode started',
		
		// 工具栏
		'ribbonTooltip': 'Folio: Multicolumn Workspace',
		
		// 功能说明
		'featureSync': 'Sync Scroll',
		'featureSyncDesc': 'Scroll left pane, right pane follows automatically',
		'featureTriple': 'Triple Pane',
		'featureTripleDesc': 'Left (prev) + Center (main) + Right (next)',
		'featurePageUp': 'Page Up',
		'featurePageUpDesc': 'Scroll both panes up by one page',
		'featurePageDown': 'Page Down',
		'featurePageDownDesc': 'Scroll both panes down by one page',
		
		// 统计
		'totalChars': 'Total Characters',
		'currPos': 'Current Position',
		
		// 其他
		'support': 'Support',
		'feedback': 'Feedback',
		'docs': 'Documentation',
		
		// 模式标签
		'modeDual': 'Dual Pane',
		'modeTriple': 'Triple Pane',
		'modeActive': 'Active',
	},
	
	// 简体中文
	zh: {
		// 设置
		'settingOverlap': '内容重叠行数',
		'settingOverlapDesc': '两个窗格之间的重叠行数（0-10行）',
		'settingLanguage': '语言',
		'settingLanguageDesc': '显示语言（默认自动检测）',
		'settingHotkeys': '快捷键',
		'settingHotkeysDesc': '在 Obsidian 设置 → 快捷键中配置',
		
		// 命令
		'cmdToggle': '切换双栏模式',
		'cmdToggleTriple': '切换三栏模式',
		'cmdStop': '停止同步阅读',
		'cmdPageUp': '双栏上翻页',
		'cmdPageDown': '双栏下翻页',
		'cmdDoublePageUp': '双栏上翻两页',
		'cmdDoublePageDown': '双栏下翻两页',
		
		// 菜单
		'menuDualMode': '双栏模式',
		'menuTripleMode': '三栏模式',
		'menuStop': '停止',
		
		// 通知
		'noticeNeedFile': '请先打开一个文件',
		'noticeNotSupported': '当前视图类型不支持',
		'noticeLeftClosed': '左侧窗格已关闭，停止跟随',
		'noticeRightClosed': '右侧窗格已关闭，停止跟随',
		'noticeStopped': '同步阅读已停止',
		'noticeDualStarted': '双栏模式已启动',
		'noticeTripleStarted': '三栏模式已启动',
		
		// 工具栏
		'ribbonTooltip': 'Folio: 多栏工作区',
		
		// 功能说明
		'featureSync': '同步滚动',
		'featureSyncDesc': '主窗格滚动，跟随窗格自动跟随',
		'featureTriple': '三栏模式',
		'featureTripleDesc': '左窗格（前一屏）+ 中窗格（主窗口）+ 右窗格（后一屏）',
		'featurePageUp': '双栏上翻页',
		'featurePageUpDesc': '同时向上滚动一页',
		'featurePageDown': '双栏下翻页',
		'featurePageDownDesc': '同时向下滚动一页',
		
		// 统计
		'totalChars': '总字符数',
		'currPos': '当前位置',
		
		// 其他
		'support': '支持',
		'feedback': '反馈问题',
		'docs': '文档',
		
		// 模式标签
		'modeDual': '双栏模式',
		'modeTriple': '三栏模式',
		'modeActive': '已启用',
	},
	
	// 繁體中文
	'zh-TW': {
		// 設置
		'settingOverlap': '內容重疊行數',
		'settingOverlapDesc': '兩個窗格之間的重疊行數（0-10行）',
		'settingLanguage': '語言',
		'settingLanguageDesc': '顯示語言（預設自動檢測）',
		'settingHotkeys': '快捷鍵',
		'settingHotkeysDesc': '在 Obsidian 設定 → 快捷鍵中設定',
		
		// 命令
		'cmdToggle': '切換雙欄模式',
		'cmdToggleTriple': '切換三欄模式',
		'cmdStop': '停止同步閱讀',
		'cmdPageUp': '雙欄上翻頁',
		'cmdPageDown': '雙欄下翻頁',
		'cmdDoublePageUp': '雙欄上翻兩頁',
		'cmdDoublePageDown': '雙欄下翻兩頁',
		
		// 菜單
		'menuDualMode': '雙欄模式',
		'menuTripleMode': '三欄模式',
		'menuStop': '停止',
		
		// 通知
		'noticeNeedFile': '請先開啟一個檔案',
		'noticeNotSupported': '目前檢視類型不支援',
		'noticeLeftClosed': '左側窗格已關閉，停止跟隨',
		'noticeRightClosed': '右側窗格已關閉，停止跟隨',
		'noticeStopped': '同步閱讀已停止',
		'noticeDualStarted': '雙欄模式已啟動',
		'noticeTripleStarted': '三欄模式已啟動',
		
		// 工具列
		'ribbonTooltip': 'Folio: 多欄工作區',
		
		// 功能說明
		'featureSync': '同步捲動',
		'featureSyncDesc': '主窗格捲動，跟隨窗格自動跟隨',
		'featureTriple': '三欄模式',
		'featureTripleDesc': '左窗格（前一屏）+ 中窗格（主視窗）+ 右窗格（後一屏）',
		'featurePageUp': '雙欄上翻頁',
		'featurePageUpDesc': '同時向上捲動一頁',
		'featurePageDown': '雙欄下翻頁',
		'featurePageDownDesc': '同時向下捲動一頁',
		
		// 統計
		'totalChars': '總字元數',
		'currPos': '目前位置',
		
		// 其他
		'support': '支援',
		'feedback': '回饋問題',
		'docs': '文件',
		
		// 模式標籤
		'modeDual': '雙欄模式',
		'modeTriple': '三欄模式',
		'modeActive': '已啟用',
	},
	
	// 日本語
	ja: {
		// 設定
		'settingOverlap': '内容の重複行数',
		'settingOverlapDesc': 'ペイン間の重複行数（0-10行）',
		'settingLanguage': '言語',
		'settingLanguageDesc': '表示言語（デフォルトで自動検出）',
		'settingHotkeys': 'ホットキー',
		'settingHotkeysDesc': 'Obsidian 設定 → ホットキーで設定',
		
		// コマンド
		'cmdToggle': '2ペインモードを切り替え',
		'cmdToggleTriple': '3ペインモードを切り替え',
		'cmdStop': '同期読み込みを停止',
		'cmdPageUp': '両方のペインを1ページ上へ',
		'cmdPageDown': '両方のペインを1ページ下へ',
		'cmdDoublePageUp': '両方のペインを2ページ上へ',
		'cmdDoublePageDown': '両方のペインを2ページ下へ',
		
		// メニュー
		'menuDualMode': '2ペインモード',
		'menuTripleMode': '3ペインモード',
		'menuStop': '停止',
		
		// 通知
		'noticeNeedFile': 'ファイルを開いてください',
		'noticeNotSupported': '現在のビュータイプはサポートされていません',
		'noticeLeftClosed': '左ペインが閉じられました',
		'noticeRightClosed': '右ペインが閉じられました',
		'noticeStopped': '同期読み込みを停止しました',
		'noticeDualStarted': '2ペインモードを開始しました',
		'noticeTripleStarted': '3ペインモードを開始しました',
		
		// リボン
		'ribbonTooltip': 'Folio: マルチカラムワークスペース',
		
		// 機能説明
		'featureSync': '同期スクロール',
		'featureSyncDesc': '左ペインをスクロールすると右ペインも自動的にスクロール',
		'featureTriple': '3ペインモード',
		'featureTripleDesc': '左（前）+ 中央（メイン）+ 右（次）',
		'featurePageUp': '1ページ上へ',
		'featurePageUpDesc': '両方のペインを同時に1ページ上へスクロール',
		'featurePageDown': '1ページ下へ',
		'featurePageDownDesc': '両方のペインを同時に1ページ下へスクロール',
		
		// 統計
		'totalChars': '総文字数',
		'currPos': '現在位置',
		
		// その他
		'support': 'サポート',
		'feedback': 'フィードバック',
		'docs': 'ドキュメント',
		
		// モードラベル
		'modeDual': '2ペイン',
		'modeTriple': '3ペイン',
		'modeActive': '有効',
	},
	
	// 한국어
	ko: {
		// 설정
		'settingOverlap': '콘텐츠 중복 줄 수',
		'settingOverlapDesc': '창 간 중복 줄 수 (0-10줄)',
		'settingLanguage': '언어',
		'settingLanguageDesc': '표시 언어 (기본값: 자동 감지)',
		'settingHotkeys': '단축키',
		'settingHotkeysDesc': 'Obsidian 설정 → 단축키에서 설정',
		
		// 명령어
		'cmdToggle': '2창 모드 전환',
		'cmdToggleTriple': '3창 모드 전환',
		'cmdStop': '동기화 읽기 중지',
		'cmdPageUp': '양쪽 창 페이지 위로',
		'cmdPageDown': '양쪽 창 페이지 아래로',
		'cmdDoublePageUp': '양쪽 창 2페이지 위로',
		'cmdDoublePageDown': '양쪽 창 2페이지 아래로',
		
		// 메뉴
		'menuDualMode': '2창 모드',
		'menuTripleMode': '3창 모드',
		'menuStop': '중지',
		
		// 알림
		'noticeNeedFile': '파일을 먼저 열어주세요',
		'noticeNotSupported': '현재 보기 유형은 지원되지 않습니다',
		'noticeLeftClosed': '왼쪽 창이 닫혔습니다',
		'noticeRightClosed': '오른쪽 창이 닫혔습니다',
		'noticeStopped': '동기화 읽기가 중지되었습니다',
		'noticeDualStarted': '2창 모드가 시작되었습니다',
		'noticeTripleStarted': '3창 모드가 시작되었습니다',
		
		// 리본
		'ribbonTooltip': 'Folio: 다중 열 작업 공간',
		
		// 기능 설명
		'featureSync': '동기화 스크롤',
		'featureSyncDesc': '왼쪽 창을 스크롤하면 오른쪽 창이 자동으로 따라감',
		'featureTriple': '3창 모드',
		'featureTripleDesc': '왼쪽 (이전) + 중앙 (메인) + 오른쪽 (다음)',
		'featurePageUp': '페이지 위로',
		'featurePageUpDesc': '양쪽 창을 동시에 한 페이지 위로 스크롤',
		'featurePageDown': '페이지 아래로',
		'featurePageDownDesc': '양쪽 창을 동시에 한 페이지 아래로 스크롤',
		
		// 통계
		'totalChars': '총 글자 수',
		'currPos': '현재 위치',
		
		// 기타
		'support': '지원',
		'feedback': '피드백',
		'docs': '문서',
		
		// 모드 라벨
		'modeDual': '2창',
		'modeTriple': '3창',
		'modeActive': '활성화됨',
	},
	
	// Français
	fr: {
		// Paramètres
		'settingOverlap': 'Chevauchement',
		'settingOverlapDesc': "Nombre de lignes de chevauchement entre les volets (0-10)",
		'settingLanguage': 'Langue',
		'settingLanguageDesc': 'Langue d\'affichage (détection automatique par défaut)',
		'settingHotkeys': 'Raccourcis',
		'settingHotkeysDesc': 'Configurer dans Obsidian → Raccourcis',
		
		// Commandes
		'cmdToggle': 'Activer/Désactiver mode 2 volets',
		'cmdToggleTriple': 'Activer/Désactiver mode 3 volets',
		'cmdStop': 'Arrêter la lecture synchronisée',
		'cmdPageUp': 'Page précédente (les deux volets)',
		'cmdPageDown': 'Page suivante (les deux volets)',
		'cmdDoublePageUp': 'Page précédente x2',
		'cmdDoublePageDown': 'Page suivante x2',
		
		// Menu
		'menuDualMode': 'Mode 2 volets',
		'menuTripleMode': 'Mode 3 volets',
		'menuStop': 'Arrêter',
		
		// Notifications
		'noticeNeedFile': 'Veuillez ouvrir un fichier',
		'noticeNotSupported': 'Type de vue non supporté',
		'noticeLeftClosed': 'Volet gauche fermé',
		'noticeRightClosed': 'Volet droit fermé',
		'noticeStopped': 'Lecture synchronisée arrêtée',
		'noticeDualStarted': 'Mode 2 volets activé',
		'noticeTripleStarted': 'Mode 3 volets activé',
		
		// Ruban
		'ribbonTooltip': 'Folio: Espace de Travail Multi-colonnes',
		
		// Description des fonctionnalités
		'featureSync': 'Défilement synchronisé',
		'featureSyncDesc': 'Le volet droit suit automatiquement le volet gauche',
		'featureTriple': 'Mode 3 volets',
		'featureTripleDesc': 'Gauche (précédent) + Centre (principal) + Droite (suivant)',
		'featurePageUp': 'Page précédente',
		'featurePageUpDesc': 'Défiler les deux volets vers le haut',
		'featurePageDown': 'Page suivante',
		'featurePageDownDesc': 'Défiler les deux volets vers le bas',
		
		// Statistiques
		'totalChars': 'Total caractères',
		'currPos': 'Position actuelle',
		
		// Autre
		'support': 'Support',
		'feedback': 'Retour',
		'docs': 'Documentation',
		
		// Étiquettes de mode
		'modeDual': '2 volets',
		'modeTriple': '3 volets',
		'modeActive': 'Actif',
	},
	
	// Deutsch
	de: {
		// Einstellungen
		'settingOverlap': 'Überlappung',
		'settingOverlapDesc': 'Anzahl der überlappenden Zeilen (0-10)',
		'settingLanguage': 'Sprache',
		'settingLanguageDesc': 'Anzeigesprache (Standard: automatisch)',
		'settingHotkeys': 'Tastenkürzel',
		'settingHotkeysDesc': 'In Obsidian Einstellungen → Tastenkürzel konfigurieren',
		
		// Befehle
		'cmdToggle': '2-Fenster-Modus umschalten',
		'cmdToggleTriple': '3-Fenster-Modus umschalten',
		'cmdStop': 'Synchronisiertes Lesen stoppen',
		'cmdPageUp': 'Seite nach oben (beide Fenster)',
		'cmdPageDown': 'Seite nach unten (beide Fenster)',
		'cmdDoublePageUp': 'Zwei Seiten nach oben',
		'cmdDoublePageDown': 'Zwei Seiten nach unten',
		
		// Menü
		'menuDualMode': '2-Fenster-Modus',
		'menuTripleMode': '3-Fenster-Modus',
		'menuStop': 'Stoppen',
		
		// Benachrichtigungen
		'noticeNeedFile': 'Bitte öffnen Sie eine Datei',
		'noticeNotSupported': 'Ansichtstyp nicht unterstützt',
		'noticeLeftClosed': 'Linkes Fenster geschlossen',
		'noticeRightClosed': 'Rechtes Fenster geschlossen',
		'noticeStopped': 'Synchronisiertes Lesen gestoppt',
		'noticeDualStarted': '2-Fenster-Modus gestartet',
		'noticeTripleStarted': '3-Fenster-Modus gestartet',
		
		// Ribbon
		'ribbonTooltip': 'Folio: Mehrspaltiger Arbeitsbereich',
		
		// Funktionsbeschreibung
		'featureSync': 'Synchronisiertes Scrollen',
		'featureSyncDesc': 'Rechtes Fenster folgt automatisch dem linken',
		'featureTriple': '3-Fenster-Modus',
		'featureTripleDesc': 'Links (vorherig) + Mitte (Haupt) + Rechts (nächster)',
		'featurePageUp': 'Seite nach oben',
		'featurePageUpDesc': 'Beide Fenster gleichzeitig nach oben scrollen',
		'featurePageDown': 'Seite nach unten',
		'featurePageDownDesc': 'Beide Fenster gleichzeitig nach unten scrollen',
		
		// Statistik
		'totalChars': 'Gesamtzeichen',
		'currPos': 'Aktuelle Position',
		
		// Sonstiges
		'support': 'Support',
		'feedback': 'Feedback',
		'docs': 'Dokumentation',
		
		// Modus-Labels
		'modeDual': '2 Fenster',
		'modeTriple': '3 Fenster',
		'modeActive': 'Aktiv',
	},
	
	// Español
	es: {
		// Configuración
		'settingOverlap': 'Solapamiento',
		'settingOverlapDesc': 'Número de líneas de solapamiento (0-10)',
		'settingLanguage': 'Idioma',
		'settingLanguageDesc': 'Idioma de visualización (detección automática por defecto)',
		'settingHotkeys': 'Atajos',
		'settingHotkeysDesc': 'Configurar en Obsidian → Atajos',
		
		// Comandos
		'cmdToggle': 'Alternar modo 2 paneles',
		'cmdToggleTriple': 'Alternar modo 3 paneles',
		'cmdStop': 'Detener lectura sincronizada',
		'cmdPageUp': 'Página anterior (ambos paneles)',
		'cmdPageDown': 'Página siguiente (ambos paneles)',
		'cmdDoublePageUp': 'Dos páginas arriba',
		'cmdDoublePageDown': 'Dos páginas abajo',
		
		// Menú
		'menuDualMode': 'Modo 2 paneles',
		'menuTripleMode': 'Modo 3 paneles',
		'menuStop': 'Detener',
		
		// Notificaciones
		'noticeNeedFile': 'Abra un archivo primero',
		'noticeNotSupported': 'Tipo de vista no soportado',
		'noticeLeftClosed': 'Panel izquierdo cerrado',
		'noticeRightClosed': 'Panel derecho cerrado',
		'noticeStopped': 'Lectura sincronizada detenida',
		'noticeDualStarted': 'Modo 2 paneles iniciado',
		'noticeTripleStarted': 'Modo 3 paneles iniciado',
		
		// Cinta
		'ribbonTooltip': 'Folio: Espacio de Trabajo Multicolumna',
		
		// Descripción de características
		'featureSync': 'Desplazamiento sincronizado',
		'featureSyncDesc': 'El panel derecho sigue automáticamente al izquierdo',
		'featureTriple': 'Modo 3 paneles',
		'featureTripleDesc': 'Izquierda (anterior) + Centro (principal) + Derecha (siguiente)',
		'featurePageUp': 'Página anterior',
		'featurePageUpDesc': 'Desplazar ambos paneles hacia arriba',
		'featurePageDown': 'Página siguiente',
		'featurePageDownDesc': 'Desplazar ambos paneles hacia abajo',
		
		// Estadísticas
		'totalChars': 'Total de caracteres',
		'currPos': 'Posición actual',
		
		// Otros
		'support': 'Soporte',
		'feedback': 'Comentarios',
		'docs': 'Documentación',
		
		// Etiquetas de modo
		'modeDual': '2 paneles',
		'modeTriple': '3 paneles',
		'modeActive': 'Activo',
	},
	
	// العربية
	ar: {
		// الإعدادات
		'settingOverlap': 'التداخل',
		'settingOverlapDesc': 'عدد أسطر التداخل (0-10)',
		'settingLanguage': 'اللغة',
		'settingLanguageDesc': 'لغة العرض (الكشف التلقائي افتراضيًا)',
		'settingHotkeys': 'اختصارات لوحة المفاتيح',
		'settingHotkeysDesc': 'تكوين في إعدادات Obsidian → اختصارات',
		
		// الأوامر
		'cmdToggle': 'تبديل وضع نافذتين',
		'cmdToggleTriple': 'تبديل وضع ثلاث نوافذ',
		'cmdStop': 'إيقاف القراءة المتزامنة',
		'cmdPageUp': 'صفحة للأعلى (النافذتين)',
		'cmdPageDown': 'صفحة للأسفل (النافذتين)',
		'cmdDoublePageUp': 'صفحتان للأعلى',
		'cmdDoublePageDown': 'صفحتان للأسفل',
		
		// القائمة
		'menuDualMode': 'وضع نافذتين',
		'menuTripleMode': 'وضع ثلاث نوافذ',
		'menuStop': 'إيقاف',
		
		// الإشعارات
		'noticeNeedFile': 'الرجاء فتح ملف أولاً',
		'noticeNotSupported': 'نوع العرض غير مدعوم',
		'noticeLeftClosed': 'تم إغلاق النافذة اليسرى',
		'noticeRightClosed': 'تم إغلاق النافذة اليمنى',
		'noticeStopped': 'تم إيقاف القراءة المتزامنة',
		'noticeDualStarted': 'تم تشغيل وضع نافذتين',
		'noticeTripleStarted': 'تم تشغيل وضع ثلاث نوافذ',
		
		// الشريط
		'ribbonTooltip': 'Folio: مساحة عمل متعددة الأعمدة',
		
		// وصف الميزات
		'featureSync': 'التمرير المتزامن',
		'featureSyncDesc': 'النافذة اليمنى تتبع اليسرى تلقائيًا',
		'featureTriple': 'وضع ثلاث نوافذ',
		'featureTripleDesc': 'اليسار (السابق) + الوسط (الرئيسي) + اليمين (التالي)',
		'featurePageUp': 'صفحة للأعلى',
		'featurePageUpDesc': 'تمرير النافذتين للأعلى معًا',
		'featurePageDown': 'صفحة للأسفل',
		'featurePageDownDesc': 'تمرير النافذتين للأسفل معًا',
		
		// الإحصائيات
		'totalChars': 'إجمالي الأحرف',
		'currPos': 'الموضع الحالي',
		
		// أخرى
		'support': 'الدعم',
		'feedback': 'ردود الفعل',
		'docs': 'التوثيق',
		
		// تسميات الوضع
		'modeDual': 'نافذتين',
		'modeTriple': 'ثلاث نوافذ',
		'modeActive': 'مفعل',
	}
};

// 当前语言
let currentLanguage: Language = 'en';

/**
 * 设置语言
 */
export function setLanguage(lang: Language): void {
	currentLanguage = lang;
}

/**
 * 获取当前语言
 */
export function getCurrentLanguage(): Language {
	return currentLanguage;
}

/**
 * 翻译函数
 */
export function t(key: string): string {
	const translation = translations[currentLanguage]?.[key];
	if (translation) return translation;
	return translations['en']?.[key] || key;
}

/**
 * 检测 Obsidian 语言
 */
export function detectObsidianLanguage(): Language {
	try {
		// @ts-ignore
		const obsidianApp = window.app as App;
		if (obsidianApp?.vault) {
			// 尝试从 localStorage 获取 Obsidian 语言设置
			const lang = localStorage.getItem('language') || navigator.language || 'en';
			const baseLang = lang.split('-')[0].toLowerCase();
			
			// 首先检查完整语言代码
			if (obsidianLanguageMap[lang]) {
				return obsidianLanguageMap[lang];
			}
			
			// 然后检查基础语言代码
			if (obsidianLanguageMap[baseLang]) {
				return obsidianLanguageMap[baseLang];
			}
		}
		
		// 使用浏览器语言作为后备
		const browserLang = navigator.language || 'en';
		const baseBrowserLang = browserLang.split('-')[0].toLowerCase();
		
		if (obsidianLanguageMap[browserLang]) return obsidianLanguageMap[browserLang];
		if (obsidianLanguageMap[baseBrowserLang]) return obsidianLanguageMap[baseBrowserLang];
	} catch (e) {
		console.warn('Failed to detect Obsidian language:', e);
	}
	return 'en';
}

/**
 * 获取语言名称
 */
export function getLanguageName(lang: Language): string {
	return languageNames[lang] || lang;
}

/**
 * 获取所有可用语言
 */
export function getAvailableLanguages(): Language[] {
	return Object.keys(languageNames) as Language[];
}

// 插件设置接口
export interface DualPanePluginSettings {
	overlapLines: number;
}

export const DEFAULT_SETTINGS: DualPanePluginSettings = {
	overlapLines: 2
};
