import { Plugin, MarkdownView, WorkspaceLeaf, Menu, TFile } from 'obsidian';

const KANBAN_VIEW_TYPE = "markdown-kanban-view";

class MarkdownKanbanView extends MarkdownView {
    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return KANBAN_VIEW_TYPE;
    }

    getDisplayText(): string {
        return `Kanban: ${this.file?.basename ?? "Unknown"}`;
    }

    async onOpen(): Promise<void> {
        // Render Kanban on open
        this.renderKanban();
    }

    async onLoadFile(file: TFile): Promise<void> {
        // Render Kanban on file load
        this.renderKanban();
    }

    async renderKanban(): Promise<void> {
        this.contentEl.empty();

        // Read file content
        const fileContent = await this.app.vault.read(this.file!);

        // Parse Markdown into tasks grouped by headings
        const sections = fileContent.split(/\n(?=# )/).map(section => {
            const [heading, ...lines] = section.split('\n');
            const tasks = lines.filter(line => line.startsWith('- [ ]') || line.startsWith('- [x]'));
            return { heading, tasks };
        });

        // Build Kanban board
        const board = this.contentEl.createDiv({ cls: 'kanban-board' });
        sections.forEach(section => {
            const column = board.createDiv({ cls: 'kanban-column' });
            column.createEl('h3', { text: section.heading.replace('#', '').trim() });

            const taskList = column.createEl('ul', { cls: 'kanban-tasks' });
            section.tasks.forEach(task => {
                const taskItem = taskList.createEl('li', { text: task });
                taskItem.addClass('kanban-task');
            });
        });
    }
}

// Main plugin class
export default class KanbanPlugin extends Plugin {
    async onload() {
        // Register Kanban view type
        this.registerView(KANBAN_VIEW_TYPE, (leaf) => new MarkdownKanbanView(leaf));

        // Add context menu option for files with `kanban: true`
        this.registerEvent(this.app.workspace.on('file-menu', (menu: Menu, file: TFile) => {
            const cache = this.app.metadataCache.getFileCache(file);

            if (cache?.frontmatter && cache.frontmatter.kanban === true) {
                menu.addItem((item) => {
                    item.setTitle("Open as Kanban")
                        .setIcon("layout")
                        .onClick(async () => {
                            const leaf = this.app.workspace.getLeaf();
                            await leaf.setViewState({
                                type: KANBAN_VIEW_TYPE,
                                state: { file: file.path },
                            });
                            this.app.workspace.revealLeaf(leaf);
                        });
                });
            }
        }));

        // Add "Back to Markdown" option in the file menu
        this.registerEvent(this.app.workspace.on("file-menu", (menu: Menu, file: TFile) => {
            const leaf = this.app.workspace.activeLeaf;
            if (leaf && leaf.view.getViewType() === KANBAN_VIEW_TYPE && file.path === (leaf.view as MarkdownKanbanView).file?.path) {
                menu.addItem((item) => {
                    item.setTitle("Back to Markdown")
                        .setIcon("file-text")
                        .onClick(async () => {
                            await leaf.setViewState({
                                type: "markdown",
                                state: { file: file.path },
                            });
                            this.app.workspace.revealLeaf(leaf);
                        });
                });
            }
        }));

        // Ensure Kanban view only applies to specified file
        this.registerEvent(
            this.app.workspace.on("active-leaf-change", (leaf) => {
                if (leaf && leaf.view.getViewType() === KANBAN_VIEW_TYPE) {
                    const kanbanView = leaf.view as MarkdownKanbanView;
                    const file = kanbanView.file;

                    if (file) {
                        const cache = this.app.metadataCache.getFileCache(file);
                        if (!cache?.frontmatter || cache.frontmatter.kanban !== true) {
                            leaf.setViewState({ type: "markdown", state: { file: file.path } });
                        }
                    }
                }
            })
        );

        // Load CSS for Kanban styling
        this.addCss();
    }

    onunload() {
        this.app.workspace.detachLeavesOfType(KANBAN_VIEW_TYPE);
    }

    addCss() {
        const style = document.createElement('style');
        style.textContent = `
            .kanban-board {
                display: flex;
                gap: 1rem;
                overflow-x: auto;
                padding: 1rem;
            }
            .kanban-column {
                background: var(--background-secondary);
                border: 1px solid var(--background-modifier-border);
                border-radius: 8px;
                padding: 1rem;
                min-width: 200px;
                flex-shrink: 0;
            }
            .kanban-task {
                margin: 0.5rem 0;
                padding: 0.5rem;
                background: var(--background-primary);
                border: 1px solid var(--background-modifier-border);
                border-radius: 4px;
            }
        `;
        document.head.appendChild(style);
    }
}
