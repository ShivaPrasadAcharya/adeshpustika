# Adeshpustika

A public file catalogue with five columns: **SN, Folder name, File name, Link, Remarks**.

Files live beside `index.html` inside the `Files` folder:

| Folder | Files |
| --- | --- |
| `Files/pdf` | PDF |
| `Files/images` | JPG, PNG, WEBP, GIF, SVG and other images |
| `Files/docs` | DOC, DOCX, ODT, RTF, TXT, MD, HTML |
| `Files/spreadsheet` | XLS, XLSX, XLSM, ODS, CSV, TSV |
| `Files/powerpoints` | PPT, PPTX, PPTM, ODP, PPS, PPSX |

## Add your collected files

Open the relevant folder in this repository, choose **Add file → Upload files**, drag in the files, then choose **Commit changes**. Files can have Nepali names, spaces and nested subfolders. Every commit to `main` automatically rebuilds the catalogue and publishes the public site through GitHub Pages. Wait for the **Publish Adeshpustika** workflow to complete, then refresh the page.

The uploaded `BestOrderCollectionKDC_Pdf.zip` collection has been imported: 20 PDFs in `Files/pdf`, with their original filenames and contents preserved. The image, document, spreadsheet and presentation folders are ready for future files. This site retains the Rayapustika catalogue features under the Adeshpustika name, with its own browser session.

## Remarks and custom link text

Edit `catalogue-metadata.json`. Use each file's exact path as a key:

```json
{
  "Files/pdf/My file.pdf": {
    "remarks": "Evidence law notes",
    "openText": "Open PDF",
    "downloadText": "Download PDF"
  }
}
```

The example above is documentation only. Link text is optional; defaults are **Open PDF**, **Download PDF**, **Open DOCX**, and so on. The page adds eye and download icons automatically.

## Browse and search

Choose a folder, search names and remarks, or use **Advanced search** for all words, any word, exact phrases, specific fields, file types, filename/remarks filters, excluded words and files with remarks. Quoted phrases work in all/any-word search. Search is case-insensitive and supports Nepali Unicode. **Nepali normalized search** is inside Advanced search, checked by default, and uses the supplied letter and numeral mappings, ignoring spaces and zero-width joiners. Uncheck it to restore standard search. **Filter matching rows** is also checked by default; uncheck it to keep all rows in the selected view while highlighting matches. Folder, file-type, excluded-word and only-with-remarks filters still apply. The counter and arrows at the end of the search bar move through matches, including across pages; Enter moves forward and Shift+Enter moves backward. Highlights preserve the original text. The search panel stays visible when scrolling; a floating arrow returns to the top. Search covers catalogue metadata, not the contents of documents. Results can be sorted and paginated.

PDFs and supported images open in a preview dialog with a full-screen toggle. DOC/DOCX, XLS/XLSX and PPT/PPTX open in the Microsoft Office web viewer when the site is online; those previews require a publicly reachable file and may depend on the viewer's format/size limits. Other formats open the original file and may download according to browser support. Every file has a direct download link.

## Browser access screen

The catalogue opens after entering mobile number `9849667879`, followed by the four-digit code `1234`. This is a local two-step access screen; it does not send SMS. Access is remembered in the same browser for a fixed six hours from verification. Reopening within one hour reuses that session; closing the page for an hour or longer requires both steps again. Backgrounding an open tab does not count as closing it. Clearing browser storage or using another browser requires verification again.

This screen is not server authentication. The repository, source credentials and direct file URLs remain public. Browser lifecycle events and a heartbeat track closure; if a browser forcibly exits without delivering a close event, the last heartbeat is used. When browser storage is unavailable, access lasts only in the current page.

## Local use

Run `python scripts/build-index.py` after changing files, then open `index.html`, or run `python -m http.server 8000`. Static browsers cannot enumerate a folder themselves; the generator builds the catalogue from the actual files. GitHub Pages runs it automatically for online use.

## Hosting

GitHub Pages uses **GitHub Actions** as its source. The included workflow generates the index, packages only the site and collected files, and publishes them. All uploaded files in this repository and its site are public.
