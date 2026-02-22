// script.js – must be loaded as type="module"

import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.min.mjs';

// Set the worker source (required for rendering)
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.worker.min.mjs';

let pdfDoc = null;
let pageNum = 1;
let pageCount = 0;
let scale = 1.5;
let canvas = null;
let ctx = null;

const pdfContainer = document.getElementById('pdf-container');
const pageNumDisplay = document.getElementById('page-num');
const pageCountDisplay = document.getElementById('page-count');

// Render the current page
async function renderPage(num) {
    if (!pdfDoc) return;

    try {
        const page = await pdfDoc.getPage(num);
        const viewport = page.getViewport({ scale });

        // Create canvas only once
        if (!canvas) {
            canvas = document.createElement('canvas');
            ctx = canvas.getContext('2d');
            pdfContainer.appendChild(canvas);
        }

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };

        await page.render(renderContext).promise;

        pageNumDisplay.textContent = num;
    } catch (err) {
        console.error('Render error:', err);
        alert('Error rendering page: ' + err.message);
    }
}

// Load PDF when file is selected
document.getElementById('pdf-upload').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file || file.type !== 'application/pdf') {
        alert('Please select a valid PDF file.');
        return;
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        pdfDoc = await loadingTask.promise;

        pageCount = pdfDoc.numPages;
        pageCountDisplay.textContent = pageCount;
        pageNum = 1;

        pdfContainer.innerHTML = ''; // Clear previous canvas
        canvas = null; // Force recreate

        await renderPage(pageNum);
    } catch (err) {
        console.error('PDF load error:', err);
        alert('Failed to load PDF: ' + err.message);
    }
});

// Navigation buttons
document.getElementById('prev-page').addEventListener('click', async () => {
    if (pageNum <= 1) return;
    pageNum--;
    await renderPage(pageNum);
});

document.getElementById('next-page').addEventListener('click', async () => {
    if (pageNum >= pageCount) return;
    pageNum++;
    await renderPage(pageNum);
});

// Zoom buttons
document.getElementById('zoom-in').addEventListener('click', async () => {
    scale += 0.2;
    await renderPage(pageNum);
});

document.getElementById('zoom-out').addEventListener('click', async () => {
    if (scale <= 0.5) return;
    scale -= 0.2;
    await renderPage(pageNum);
});

// Simple text search (checks current page text)
document.getElementById('search-btn').addEventListener('click', async () => {
    if (!pdfDoc) return;

    const searchText = document.getElementById('search-text').value.trim().toLowerCase();
    if (!searchText) {
        alert('Enter text to search.');
        return;
    }

    try {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        let pageText = '';
        textContent.items.forEach(item => {
            pageText += item.str.toLowerCase() + ' ';
        });

        if (pageText.includes(searchText)) {
            alert(`Found "${searchText}" on this page!`);
        } else {
            alert(`"${searchText}" not found on this page.`);
        }
    } catch (err) {
        alert('Search error: ' + err.message);
    }
});

// Notes – saved in browser localStorage
document.getElementById('save-notes').addEventListener('click', () => {
    const notes = document.getElementById('notes').value;
    localStorage.setItem('pdfReaderNotes', notes);
    alert('Notes saved!');
});

// Load saved notes on start
document.getElementById('notes').value = localStorage.getItem('pdfReaderNotes') || '';

// Optional: Clear notes button (add if you want)
// <button id="clear-notes">Clear Notes</button>
// Then:
// document.getElementById('clear-notes').addEventListener('click', () => {
//     localStorage.removeItem('pdfReaderNotes');
//     document.getElementById('notes').value = '';
//     alert('Notes cleared.');
// });