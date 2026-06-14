// Attribution text. CC BY-SA requires visible credit + same-license notice.
// BodyParts3D is the v0 data source; Z-Anatomy is noted as the upgrade path.
export const ATTRIBUTION_HTML = `
  3D anatomy data: <strong>BodyParts3D</strong>, &copy; The Database Center for Life Science,
  licensed under
  <a href="https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en" target="_blank" rel="noopener">CC&nbsp;BY-SA&nbsp;2.1&nbsp;Japan</a>.
  This application is shared under
  <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC&nbsp;BY-SA&nbsp;4.0</a>
  (share-alike). Descriptive text adapted from
  <a href="https://en.wikipedia.org" target="_blank" rel="noopener">Wikipedia</a> (CC&nbsp;BY-SA&nbsp;4.0);
  anatomical organisation informed by
  <a href="https://www.z-anatomy.com" target="_blank" rel="noopener">Z-Anatomy</a> (CC&nbsp;BY-SA&nbsp;4.0).
`;

export function renderFooter(el: HTMLElement): void {
  el.innerHTML = ATTRIBUTION_HTML;
}
