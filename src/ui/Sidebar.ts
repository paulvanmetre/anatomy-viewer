import type { Structure, SystemEntry } from '../types';

export interface SidebarCallbacks {
  onToggleSystem(id: string, active: boolean): void;
  onToggleStructure(id: string, visible: boolean): void;
  onIsolate(id: string): void;
  onShowAll(): void;
  onSelectStructure(id: string): void;
}

export interface StructureState {
  visibility: Map<string, boolean>;
  isolatedId: string | null;
  selectedId: string | null;
}

/** Left-hand navigation: organ systems + the current system's structures. */
export class Sidebar {
  private readonly systemsEl: HTMLElement;
  private readonly structuresEl: HTMLElement;
  private readonly rows = new Map<string, HTMLElement>();
  private readonly checkboxes = new Map<string, HTMLInputElement>();

  constructor(
    private readonly root: HTMLElement,
    private readonly cb: SidebarCallbacks,
  ) {
    this.root.innerHTML = `
      <h1 class="brand">Anatomy&nbsp;Viewer <span class="tag">v0</span></h1>
      <h2 class="section-title">Organ systems</h2>
      <ul id="systems-list" class="systems"></ul>
      <div class="structures-header">
        <h2 class="section-title">Structures</h2>
        <button id="show-all" class="btn-ghost" type="button" hidden>Show all</button>
      </div>
      <ul id="structures-list" class="structures"></ul>
    `;
    this.systemsEl = this.root.querySelector('#systems-list')!;
    this.structuresEl = this.root.querySelector('#structures-list')!;
    this.root.querySelector('#show-all')!.addEventListener('click', () => this.cb.onShowAll());
  }

  /** Render organ systems as toggleable layers (enabled ones can be on/off). */
  setSystems(systems: SystemEntry[], activeIds: Set<string>): void {
    this.systemsEl.innerHTML = '';
    for (const sys of systems) {
      const li = document.createElement('li');
      li.className = 'system-item';
      if (!sys.enabled) {
        li.classList.add('disabled');
        li.textContent = sys.name;
        const badge = document.createElement('span');
        badge.className = 'soon';
        badge.textContent = 'coming soon';
        li.appendChild(badge);
      } else {
        const active = activeIds.has(sys.id);
        if (active) li.classList.add('active');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = active;
        checkbox.title = 'Show / hide this layer';
        checkbox.addEventListener('change', () =>
          this.cb.onToggleSystem(sys.id, checkbox.checked),
        );
        const label = document.createElement('span');
        label.className = 'system-label';
        label.textContent = sys.name;
        label.addEventListener('click', () => {
          checkbox.checked = !checkbox.checked;
          this.cb.onToggleSystem(sys.id, checkbox.checked);
        });
        li.append(checkbox, label);
      }
      this.systemsEl.appendChild(li);
    }
  }

  /** Render the loaded structures, grouped by system. */
  setStructures(structures: Structure[], systems: SystemEntry[]): void {
    this.structuresEl.innerHTML = '';
    this.rows.clear();
    this.checkboxes.clear();

    const nameOf = new Map(systems.map((s) => [s.id, s.name]));
    const showGroupHeaders = new Set(structures.map((s) => s.system)).size > 1;
    let currentSystem: string | null = null;

    for (const s of structures) {
      if (showGroupHeaders && s.system !== currentSystem) {
        currentSystem = s.system;
        const header = document.createElement('li');
        header.className = 'structure-group';
        header.textContent = nameOf.get(s.system) ?? s.system;
        this.structuresEl.appendChild(header);
      }

      const li = document.createElement('li');
      li.className = 'structure-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = true;
      checkbox.title = 'Show / hide';
      checkbox.addEventListener('change', () =>
        this.cb.onToggleStructure(s.id, checkbox.checked),
      );

      const name = document.createElement('button');
      name.className = 'structure-name';
      name.type = 'button';
      name.textContent = s.name;
      name.addEventListener('click', () => this.cb.onSelectStructure(s.id));

      const isolate = document.createElement('button');
      isolate.className = 'btn-ghost isolate';
      isolate.type = 'button';
      isolate.textContent = 'isolate';
      isolate.title = 'Hide everything else';
      isolate.addEventListener('click', () => this.cb.onIsolate(s.id));

      li.append(checkbox, name, isolate);
      this.structuresEl.appendChild(li);
      this.rows.set(s.id, li);
      this.checkboxes.set(s.id, checkbox);
    }
  }

  setStructureState(state: StructureState): void {
    const showAllBtn = this.root.querySelector('#show-all') as HTMLButtonElement;
    showAllBtn.hidden = state.isolatedId === null;

    for (const [id, row] of this.rows) {
      row.classList.toggle('selected', id === state.selectedId);
      const cb = this.checkboxes.get(id);
      if (cb) cb.checked = state.visibility.get(id) ?? true;
    }
  }
}
