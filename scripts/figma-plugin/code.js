/**
 * GeekSpace UI Import — Figma Plugin
 *
 * Imports screenshots captured by capture-ui.mjs into Figma as editable frames.
 * Creates one Figma page per viewport (Desktop / Tablet / Mobile),
 * arranges frames in a labelled grid.
 *
 * Install: Figma → Plugins → Development → Import plugin from manifest
 *          Select this directory's manifest.json
 */

figma.showUI(__html__, { width: 520, height: 640, themeColors: true });

const VIEWPORT_DIMS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 812 },
};

const GRID = {
  desktop: { cols: 3, padding: 100, labelGap: 44 },
  tablet: { cols: 4, padding: 80, labelGap: 44 },
  mobile: { cols: 6, padding: 60, labelGap: 44 },
};

const LABEL_FONT = { family: 'Inter', style: 'Semi Bold' };
const SECTION_FONT = { family: 'Inter', style: 'Bold' };

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'import') {
    const { files } = msg; // Array<{ name, viewport, bytes: number[] }>

    try {
      // Load fonts we'll use for labels
      await figma.loadFontAsync(LABEL_FONT);
      await figma.loadFontAsync(SECTION_FONT);

      // Group files by viewport
      const grouped = {};
      for (const f of files) {
        const vp = f.viewport || 'desktop';
        if (!grouped[vp]) grouped[vp] = [];
        grouped[vp].push(f);
      }

      let totalCreated = 0;

      for (const [viewport, shots] of Object.entries(grouped)) {
        // Sort alphabetically so layout is deterministic
        shots.sort((a, b) => a.name.localeCompare(b.name));

        // Separate public vs dashboard routes
        const publicShots = shots.filter(s => !s.name.startsWith('dashboard-'));
        const dashboardShots = shots.filter(s => s.name.startsWith('dashboard-'));

        // Create a Figma page for this viewport
        const page = figma.createPage();
        const vpLabel = viewport.charAt(0).toUpperCase() + viewport.slice(1);
        const dims = VIEWPORT_DIMS[viewport] || VIEWPORT_DIMS.desktop;
        const grid = GRID[viewport] || GRID.desktop;
        page.name = `UI — ${vpLabel} (${dims.width}px)`;

        let yOffset = 0;

        // Helper: lay out a section of shots
        async function layoutSection(title, sectionShots, startY) {
          if (sectionShots.length === 0) return startY;

          // Section title
          const sectionLabel = figma.createText();
          sectionLabel.fontName = SECTION_FONT;
          sectionLabel.characters = title;
          sectionLabel.fontSize = 32;
          sectionLabel.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 } }];
          sectionLabel.x = 0;
          sectionLabel.y = startY;
          page.appendChild(sectionLabel);

          let y = startY + 60;

          for (let i = 0; i < sectionShots.length; i++) {
            const shot = sectionShots[i];
            const col = i % grid.cols;
            const row = Math.floor(i / grid.cols);

            const x = col * (dims.width + grid.padding);
            const frameY = y + row * (dims.height + grid.padding + grid.labelGap);

            // Frame label
            const label = figma.createText();
            label.fontName = LABEL_FONT;
            label.characters = shot.name.replace('dashboard-', '').replace(/-/g, ' ');
            label.fontSize = 18;
            label.fills = [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.4 } }];
            label.x = x;
            label.y = frameY - grid.labelGap + 8;
            page.appendChild(label);

            // Screenshot frame
            const frame = figma.createFrame();
            frame.name = shot.name;
            frame.resize(dims.width, dims.height);
            frame.x = x;
            frame.y = frameY;
            frame.cornerRadius = 8;
            frame.clipsContent = true;

            // Set screenshot as image fill
            const image = figma.createImage(new Uint8Array(shot.bytes));
            frame.fills = [{
              type: 'IMAGE',
              scaleMode: 'FIT',
              imageHash: image.hash,
            }];

            // Subtle shadow
            frame.effects = [{
              type: 'DROP_SHADOW',
              color: { r: 0, g: 0, b: 0, a: 0.08 },
              offset: { x: 0, y: 4 },
              radius: 16,
              spread: 0,
              visible: true,
              blendMode: 'NORMAL',
            }];

            page.appendChild(frame);
            totalCreated++;
          }

          // Return next Y position
          const rows = Math.ceil(sectionShots.length / grid.cols);
          return y + rows * (dims.height + grid.padding + grid.labelGap) + 60;
        }

        yOffset = await layoutSection('Public Pages', publicShots, yOffset);
        yOffset = await layoutSection('Dashboard', dashboardShots, yOffset);
      }

      figma.notify(`Imported ${totalCreated} screenshots across ${Object.keys(grouped).length} viewport(s)`);
      figma.ui.postMessage({ type: 'done', count: totalCreated });

    } catch (err) {
      figma.notify('Import failed: ' + err.message, { error: true });
      figma.ui.postMessage({ type: 'error', message: err.message });
    }
  }

  if (msg.type === 'cancel') {
    figma.closePlugin();
  }
};
