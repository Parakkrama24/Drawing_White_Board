# Canvas Board

A desktop whiteboard for Windows built with Electron. It works fully offline and includes:

- Pen, eraser, and four brush styles
- Line, rectangle/square, circle, triangle, and arrow tools
- White, green, black, and custom backgrounds
- Preset and custom stroke colors with adjustable size
- Image import, selection, movement, and deletion
- Multiple independent pages with floating navigation and a live page counter
- Undo, redo, clear, PNG export, and PDF export
- Keyboard shortcuts and a responsive desktop interface

## Run locally

```powershell
npm install
npm start
```

## Build the Windows installer

```powershell
npm run dist
```

The installer will be written to the `dist` folder.

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `V` | Select tool |
| `P` | Pen |
| `B` | Brush |
| `E` | Eraser |
| `L` | Line |
| `R` | Rectangle |
| `C` | Circle |
| `T` | Triangle |
| `A` | Arrow |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Delete` | Delete selected image |
| `Page Up` / `Page Down` | Previous / next page |

Hold `Shift` while drawing a rectangle or circle to constrain it to a perfect square or circle.

PNG export saves the current page. PDF export includes every page in order.
