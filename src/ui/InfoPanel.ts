import type { Landmark, Reference, Selection, Structure } from '../types';

export interface InfoPanelCallbacks {
  onSelectLandmark(landmarkId: string): void;
  onClose(): void;
}

/** Right-hand info pop-out for the selected structure or landmark. */
export class InfoPanel {
  constructor(
    private readonly root: HTMLElement,
    private readonly cb: InfoPanelCallbacks,
  ) {}

  hide(): void {
    this.root.classList.add('hidden');
    this.root.innerHTML = '';
  }

  show(selection: Selection): void {
    if (!selection) {
      this.hide();
      return;
    }
    this.root.classList.remove('hidden');
    const { structure } = selection;

    const header = `
      <button class="close" type="button" aria-label="Close">&times;</button>
      <h2 class="info-name">${escape(structure.name)}</h2>
      ${structure.latinName ? `<p class="latin">${escape(structure.latinName)}</p>` : ''}
      <div class="info-meta">
        <span class="chip">${escape(structure.system)}</span>
        <span class="chip">${escape(structure.region)}</span>
        ${structure.fmaId ? `<span class="chip mono">${escape(structure.fmaId)}</span>` : ''}
        ${structure.schematic ? `<span class="chip schematic">schematic</span>` : ''}
      </div>`;

    const body =
      selection.kind === 'landmark'
        ? this.landmarkBody(selection.structure.name, selection.landmark)
        : this.structureBody(structure);

    this.root.innerHTML = header + body + refsSection(structure.references);
    this.bind();
  }

  private structureBody(structure: Structure): string {
    const landmarks = structure.landmarks ?? [];
    const landmarkSection = landmarks.length
      ? `<h3 class="subhead">Landmarks (${landmarks.length})</h3>
         <ul class="landmark-list">${landmarks
           .map(
             (l) =>
               `<li><button class="landmark-link" type="button" data-id="${escape(
                 l.id,
               )}">${escape(l.name)}</button></li>`,
           )
           .join('')}</ul>`
      : '';

    return `
      <p class="info-desc">${escape(structure.description)}</p>
      ${structure.classification ? detailLine('Type', structure.classification) : ''}
      ${structure.origin ? detailLine('Origin', structure.origin) : ''}
      ${structure.insertion ? detailLine('Insertion', structure.insertion) : ''}
      ${structure.action ? detailLine('Action', structure.action) : ''}
      ${structure.innervation ? detailLine('Innervation', structure.innervation) : ''}
      ${bulletSection('Articulations', structure.articulations)}
      ${bulletSection('Muscle attachments', structure.muscleAttachments)}
      ${landmarkSection}
      ${bulletSection('Clinical notes', structure.clinical)}`;
  }

  private landmarkBody(structureName: string, landmark: Landmark): string {
    return `
      <p class="info-context">Landmark on ${escape(structureName)}</p>
      <h3 class="landmark-title">${escape(landmark.name)}</h3>
      <p class="info-desc">${escape(landmark.description)}</p>
      <button class="btn-ghost back" type="button">&larr; Back to ${escape(structureName)}</button>`;
  }

  private bind(): void {
    this.root.querySelector('.close')!.addEventListener('click', () => this.cb.onClose());
    this.root.querySelectorAll<HTMLButtonElement>('.landmark-link').forEach((btn) =>
      btn.addEventListener('click', () => this.cb.onSelectLandmark(btn.dataset.id!)),
    );
    const back = this.root.querySelector('.back');
    if (back) back.addEventListener('click', () => this.cb.onSelectLandmark(''));
  }
}

function detailLine(key: string, value: string): string {
  return `<p class="detail-line"><span class="detail-key">${escape(key)}</span> ${escape(value)}</p>`;
}

function bulletSection(title: string, items: string[] | undefined): string {
  if (!items || items.length === 0) return '';
  return `
    <h3 class="subhead">${escape(title)}</h3>
    <ul class="detail-list">${items.map((i) => `<li>${escape(i)}</li>`).join('')}</ul>`;
}

function refsSection(refs: Reference[] | undefined): string {
  if (!refs || refs.length === 0) return '';
  const links = refs
    .map(
      (r) =>
        `<a class="ref-link" href="${escape(r.url)}" target="_blank" rel="noopener">${escape(
          r.label,
        )}</a>`,
    )
    .join('');
  return `<div class="refs"><span class="refs-label">Sources (CC BY-SA)</span>${links}</div>`;
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return '&#39;';
    }
  });
}
