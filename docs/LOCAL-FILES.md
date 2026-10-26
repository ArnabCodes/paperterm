# Local files — local review

Press `o` to open **Local files**. This is distinct from **Recent**, which contains the reader's existing limited library of saved PDF copies. With no connected folder, the center column explains how to show files and provides keyboard-focusable Choose local folder and Choose PDF files actions. The left column provides Downloads/Documents starting locations and a return to the connected folder.

The browser must initially ask you to select a folder; an extension cannot silently list the entire disk. Access is read-only. Supported directory handles are stored in a separate local IndexedDB database, without copying directory contents or changing the existing PDF library. On reload, Pipit only queries existing read permission. If it has expired, a visible Reconnect action requests it in response to a user gesture. Permission denial and deleted/unavailable folders leave a recovery action instead of a blank file list. Filesystem exploration stays within the chosen root.

Where directory handles are unavailable, an attached directory input imports the selected folder's PDF hierarchy for this session. Add PDFs also remains available. Fallback inputs do not retain permission or automatically restore files after reload. Downloads/Documents are suggested starting locations for the permission picker, not silent grants to those folders. Browsers may ignore the starting-location hint.

The internal list shows PDF filenames and folders; files of other types are excluded. Arrows or `h j k l` navigate; Enter opens the selected PDF, `/` filters the current folder, Tab reaches location controls, and Escape closes. Actual file bytes are read only when a PDF is opened. No network service is used for file browsing.

## Verification

`scripts/verification/local-files.js` exercises a separate test browser on port 4192. It uses actual serializable browser-managed directory handles with the bundled research-PDF fixture to verify folder enumeration, nested keyboard navigation, IndexedDB handle restoration after reload, switching Recent/Local, and actual PDF rendering. It separately checks relative-path input fallback and simulates expired read permission to verify explicit recovery without silent permission requests. It checks narrow-viewport sizing as well.

These are Chromium browser checks, not a claim that native OS permission dialogs or Safari/Firefox runtime behavior have been manually verified. The browser-managed test directory is separate from the user's real folders. No release is published by this change.
